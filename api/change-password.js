// api/change-password.js - Vercel Serverless Function
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
        message: 'feat(auth): update user password',
        content: content,
        sha: sha
      })
    }
  );

  if (!response.ok) {
    throw new Error('Şifre güncellenemedi');
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
    // JWT token kontrolü
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

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ 
        success: false, 
        message: 'Mevcut şifre ve yeni şifre gerekli' 
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ 
        success: false, 
        message: 'Yeni şifre en az 6 karakter olmalı' 
      });
    }

    // Credentials dosyasını oku
    const { credentials, sha } = await getCredentials();

    // Kullanıcıyı bul
    let userIndex = -1;
    let isPatient = false;
    let userList = credentials.users;

    userIndex = userList?.findIndex(u => u.username === decoded.username);

    if (userIndex === -1) {
      userList = credentials.patients;
      userIndex = userList?.findIndex(p => p.username === decoded.username);
      isPatient = true;
    }

    if (userIndex === -1) {
      return res.status(404).json({ 
        success: false, 
        message: 'Kullanıcı bulunamadı' 
      });
    }

    const user = userList[userIndex];

    // Mevcut şifre kontrolü
    const isValidPassword = await bcrypt.compare(currentPassword, user.passwordHash);

    if (!isValidPassword) {
      return res.status(401).json({ 
        success: false, 
        message: 'Mevcut şifre hatalı' 
      });
    }

    // Yeni şifreyi hashle
    const salt = await bcrypt.genSalt(10);
    const newPasswordHash = await bcrypt.hash(newPassword, salt);

    // Şifreyi güncelle
    user.passwordHash = newPasswordHash;
    user.passwordChangedAt = new Date().toISOString();

    credentials.lastUpdated = new Date().toISOString();

    // GitHub'a kaydet
    await updateCredentials(credentials, sha);

    return res.status(200).json({
      success: true,
      message: 'Şifre başarıyla değiştirildi'
    });

  } catch (error) {
    console.error('Change password error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Sunucu hatası: ' + error.message 
    });
  }
}
