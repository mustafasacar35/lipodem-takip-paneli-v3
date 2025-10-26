// api/register-patient.js - Vercel Serverless Function (Admin only)
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = 'mustafasacar35/lipodem-takip-paneli-3';

// GitHub'dan credentials dosyasını oku
async function getCredentials() {
  const response = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/contents/data/hasta_credentials.json`,
    {
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    }
  );

  if (!response.ok) {
    throw new Error('Credentials dosyası okunamadı');
  }

  const data = await response.json();
  const content = Buffer.from(data.content, 'base64').toString('utf-8');
  return { credentials: JSON.parse(content), sha: data.sha };
}

// GitHub'a credentials dosyasını yaz
async function updateCredentials(credentials, sha) {
  const content = Buffer.from(JSON.stringify(credentials, null, 2)).toString('base64');
  
  const response = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/contents/data/hasta_credentials.json`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: 'feat(auth): register new patient',
        content: content,
        sha: sha
      })
    }
  );

  if (!response.ok) {
    throw new Error('Hasta kaydı oluşturulamadı');
  }

  return await response.json();
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    // JWT token kontrolü (sadece admin)
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false, 
        message: 'Yetkilendirme gerekli' 
      });
    }

    const token = authHeader.substring(7);
    let decoded;
    
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ 
        success: false, 
        message: 'Geçersiz token' 
      });
    }

    // Admin kontrolü
    if (decoded.role !== 'admin' && decoded.role !== 'dietitian') {
      return res.status(403).json({ 
        success: false, 
        message: 'Bu işlem için yetkiniz yok' 
      });
    }

    const { patientId, username, password, fullName, email } = req.body;

    if (!patientId || !username || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Hasta ID, kullanıcı adı ve şifre gerekli' 
      });
    }

    if (password.length < 6) {
      return res.status(400).json({ 
        success: false, 
        message: 'Şifre en az 6 karakter olmalı' 
      });
    }

    // Credentials dosyasını oku
    const { credentials, sha } = await getCredentials();

    // Kullanıcı adı kontrolü
    const existingUser = credentials.users?.find(u => u.username === username);
    const existingPatient = credentials.patients?.find(p => p.username === username);

    if (existingUser || existingPatient) {
      return res.status(409).json({ 
        success: false, 
        message: 'Bu kullanıcı adı zaten kullanılıyor' 
      });
    }

    // Şifreyi hashle
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Yeni hasta kaydı
    const newPatient = {
      id: `patient_${Date.now()}`,
      patientId: patientId,
      username: username,
      passwordHash: passwordHash,
      role: 'patient',
      fullName: fullName || '',
      email: email || '',
      active: true,
      createdAt: new Date().toISOString(),
      createdBy: decoded.username
    };

    // Patients array'i yoksa oluştur
    if (!credentials.patients) {
      credentials.patients = [];
    }

    credentials.patients.push(newPatient);
    credentials.lastUpdated = new Date().toISOString();

    // GitHub'a kaydet
    await updateCredentials(credentials, sha);

    return res.status(201).json({
      success: true,
      message: 'Hasta kaydı başarıyla oluşturuldu',
      patient: {
        id: newPatient.id,
        patientId: newPatient.patientId,
        username: newPatient.username,
        fullName: newPatient.fullName
      }
    });

  } catch (error) {
    console.error('Register patient error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Sunucu hatası: ' + error.message 
    });
  }
}
