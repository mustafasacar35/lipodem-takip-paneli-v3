// api/login.js - Vercel Serverless Function
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
  return JSON.parse(content);
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Kullanıcı adı ve şifre gerekli' 
      });
    }

    // Credentials dosyasını oku
    const credentials = await getCredentials();

    // Kullanıcıyı bul (users veya patients içinde)
    let user = credentials.users?.find(u => u.username === username);
    let isPatient = false;

    if (!user) {
      user = credentials.patients?.find(p => p.username === username);
      isPatient = true;
    }

    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Kullanıcı adı veya şifre hatalı' 
      });
    }

    // Kullanıcı aktif mi kontrol et
    if (user.active === false) {
      return res.status(403).json({ 
        success: false, 
        message: 'Hesabınız devre dışı bırakılmış' 
      });
    }

    // Şifre kontrolü
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);

    if (!isValidPassword) {
      return res.status(401).json({ 
        success: false, 
        message: 'Kullanıcı adı veya şifre hatalı' 
      });
    }

    // JWT token oluştur
    const token = jwt.sign(
      { 
        id: user.id,
        username: user.username,
        role: user.role || (isPatient ? 'patient' : 'user')
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Güvenli user objesi (şifre olmadan)
    const safeUser = {
      id: user.id,
      username: user.username,
      role: user.role || (isPatient ? 'patient' : 'user'),
      fullName: user.fullName,
      email: user.email,
      patientId: user.patientId // Eğer hasta ise
    };

    return res.status(200).json({
      success: true,
      message: 'Giriş başarılı',
      token,
      user: safeUser
    });

  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Sunucu hatası: ' + error.message 
    });
  }
}
