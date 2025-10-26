// api/change-password.js - Vercel Serverless Function
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
    // JWT token kontrolü
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

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Mevcut ve yeni şifre gereklidir'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Yeni şifre en az 6 karakter olmalıdır'
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

    // Kullanıcıyı bul
    let user = credentials.users?.find(u => u.id === decoded.id);
    let isPatient = false;
    
    if (!user) {
      user = credentials.patients?.find(p => p.id === decoded.id);
      isPatient = true;
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Kullanıcı bulunamadı'
      });
    }

    // Mevcut şifre kontrolü
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
    
    if (!isCurrentPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Mevcut şifre hatalı'
      });
    }

    // Yeni şifreyi hashle
    const newPasswordHash = await bcrypt.hash(newPassword, 10);
    
    // Kullanıcının şifresini güncelle
    user.passwordHash = newPasswordHash;
    user.lastPasswordChange = new Date().toISOString();
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
          message: `Şifre değiştirildi: ${user.username}`,
          content: Buffer.from(JSON.stringify(credentials, null, 2)).toString('base64'),
          sha: fileData.sha
        })
      }
    );

    if (!updateResponse.ok) {
      throw new Error('GitHub update error: ' + updateResponse.statusText);
    }

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
};
};
