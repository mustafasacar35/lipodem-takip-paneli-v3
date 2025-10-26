// api/login.js - Vercel Serverless Function
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

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
    throw new Error('GitHub API error: ' + response.statusText);
  }

  const data = await response.json();
  const content = Buffer.from(data.content, 'base64').toString('utf8');
  return JSON.parse(content);
}

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
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Kullanıcı adı ve şifre gereklidir'
      });
    }

    // Credentials'ı GitHub'dan al
    const credentials = await getCredentials();
    
    // Kullanıcıyı bul (users veya patients array'inde)
    let user = credentials.users?.find(u => u.username === username);
    if (!user) {
      user = credentials.patients?.find(p => p.username === username);
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Kullanıcı adı veya şifre hatalı'
      });
    }

    // Şifre kontrolü
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Kullanıcı adı veya şifre hatalı'
      });
    }

    // Kullanıcı aktif mi?
    if (!user.active) {
      return res.status(403).json({
        success: false,
        message: 'Hesabınız devre dışı bırakılmış'
      });
    }

    // JWT token oluştur
    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
        patientId: user.patientId || null
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Başarılı yanıt
    return res.status(200).json({
      success: true,
      message: 'Giriş başarılı',
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        fullName: user.fullName,
        email: user.email,
        patientId: user.patientId || null
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      message: 'Sunucu hatası: ' + error.message
    });
  }
};
