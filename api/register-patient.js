// api/register-patient.js - Vercel Serverless Function
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = 'mustafasacar35/lipodem-takip-paneli-3';

module.exports = async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
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
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // JWT token kontrolü - Sadece admin ve dietitian kayıt yapabilir
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Yetkilendirme token\'ı gerekli'
      });
    }

    const token = authHeader.substring(7);
    let decoded;
    
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: 'Geçersiz veya süresi dolmuş token'
      });
    }

    // Yetki kontrolü
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
        message: 'Hasta ID, kullanıcı adı ve şifre gereklidir'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Şifre en az 6 karakter olmalıdır'
      });
    }

    // GitHub'dan credentials dosyasını al
    const getResponse = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/contents/data/hasta_credentials.json`,
      {
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      }
    );

    if (!getResponse.ok) {
      throw new Error('GitHub API error: ' + getResponse.statusText);
    }

    const fileData = await getResponse.json();
    const credentials = JSON.parse(Buffer.from(fileData.content, 'base64').toString('utf8'));

    // Kullanıcı adı kontrolü
    const usernameExists = 
      credentials.users?.some(u => u.username === username) ||
      credentials.patients?.some(p => p.username === username);

    if (usernameExists) {
      return res.status(409).json({
        success: false,
        message: 'Bu kullanıcı adı zaten kullanılıyor'
      });
    }

    // Şifreyi hashle
    const passwordHash = await bcrypt.hash(password, 10);

    // Yeni hasta kaydı oluştur
    const newPatient = {
      id: `patient_${Date.now()}`,
      patientId,
      username,
      passwordHash,
      role: 'patient',
      fullName: fullName || username,
      email: email || '',
      active: true,
      createdAt: new Date().toISOString(),
      createdBy: decoded.username
    };

    // Patients array yoksa oluştur
    if (!credentials.patients) {
      credentials.patients = [];
    }

    credentials.patients.push(newPatient);
    credentials.lastUpdated = new Date().toISOString();

    // GitHub'a geri yaz
    const updateResponse = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/contents/data/hasta_credentials.json`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: `Yeni hasta kaydı: ${username}`,
          content: Buffer.from(JSON.stringify(credentials, null, 2)).toString('base64'),
          sha: fileData.sha
        })
      }
    );

    if (!updateResponse.ok) {
      throw new Error('GitHub update error: ' + updateResponse.statusText);
    }

    return res.status(201).json({
      success: true,
      message: 'Hasta kaydı başarıyla oluşturuldu',
      patient: {
        id: newPatient.id,
        patientId: newPatient.patientId,
        username: newPatient.username,
        fullName: newPatient.fullName,
        email: newPatient.email,
        createdAt: newPatient.createdAt
      }
    });

  } catch (error) {
    console.error('Register patient error:', error);
    return res.status(500).json({
      success: false,
      message: 'Sunucu hatası: ' + error.message
    });
  }
};
};
