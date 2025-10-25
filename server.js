require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');

const app = express();
const ROOT_DIR = __dirname;
const PORT = Number(process.env.PORT || 8081);
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const GITHUB_REPO = process.env.GITHUB_REPO || '';
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || '';

const MAX_BODY_SIZE = process.env.REQUEST_LIMIT || '20mb';

// === Global middleware ===
app.use(express.json({ limit: MAX_BODY_SIZE }));
app.use(express.urlencoded({ extended: true, limit: MAX_BODY_SIZE }));

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.status(204).send();
  }
  next();
});

// === Helper: ensure dotfiles are not served ===
const staticOptions = {
  extensions: ['html'],
  dotfiles: 'ignore',
  fallthrough: true,
  setHeaders(res, filePath) {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-store');
    }
  }
};

// === Config endpoint so the front-end knows proxy status ===
app.get('/api/config', (req, res) => {
  res.json({
    githubProxy: Boolean(GITHUB_TOKEN),
    defaultRepo: GITHUB_REPO || null,
    defaultBranch: GITHUB_BRANCH || null
  });
});

// === GitHub proxy ===
app.all('/api/github/*', async (req, res) => {
  if (!GITHUB_TOKEN) {
    return res.status(500).json({ error: 'Sunucu GitHub tokenı tanımlı değil' });
  }

  const proxyPath = req.originalUrl.replace(/^\/api\/github\//, '');
  if (!proxyPath) {
    return res.status(400).json({ error: 'GitHub yolu belirtilmedi' });
  }

  const targetUrl = `https://api.github.com/${proxyPath}`;

  const headers = {
    Authorization: `Bearer ${GITHUB_TOKEN}`,
    'User-Agent': 'lipodem-takip-paneli-proxy'
  };

  const acceptHeader = req.get('Accept');
  if (acceptHeader) headers['Accept'] = acceptHeader;

  const contentType = req.get('Content-Type');
  if (contentType) headers['Content-Type'] = contentType;

  const init = {
    method: req.method,
    headers
  };

  const upperMethod = req.method.toUpperCase();
  if (!['GET', 'HEAD'].includes(upperMethod)) {
    if (contentType && contentType.includes('application/json')) {
      init.body = JSON.stringify(req.body ?? {});
    } else if (typeof req.body === 'string') {
      init.body = req.body;
    } else if (req.body && Object.keys(req.body).length > 0) {
      init.body = JSON.stringify(req.body);
    } else if (req._readableState && !req._readableState.ended) {
      const chunks = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      init.body = Buffer.concat(chunks);
    }
  }

  try {
    const ghResponse = await fetch(targetUrl, init);
    const buffer = Buffer.from(await ghResponse.arrayBuffer());

    res.status(ghResponse.status);
    ghResponse.headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      if (['transfer-encoding', 'content-encoding', 'content-length'].includes(lowerKey)) return;
      res.setHeader(key, value);
    });

    res.send(buffer);
  } catch (error) {
    console.error('[GitHub Proxy] Hata:', error);
    res.status(500).json({ error: 'GitHub proxy hatası', detail: error.message });
  }
});

// === Static file serving ===
app.use(express.static(ROOT_DIR, staticOptions));

app.get('/', (req, res) => {
  res.sendFile(path.join(ROOT_DIR, 'entry.html'));
});

app.get('/index', (req, res) => {
  res.redirect(302, '/index.html');
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', githubProxy: Boolean(GITHUB_TOKEN) });
});

// === Fallback for other static files ===
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  const filePath = path.join(ROOT_DIR, req.path);
  if (!filePath.startsWith(ROOT_DIR)) {
    return res.status(400).send('Bad Request');
  }
  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      return res.status(404).send('404 Not Found');
    }
    res.sendFile(filePath);
  });
});

const server = app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  console.log(`📋 Test login page: http://localhost:${PORT}/entry.html`);
  console.log(`🏠 Main panel: http://localhost:${PORT}/index.html`);
  console.log(`🔑 GitHub proxy: ${GITHUB_TOKEN ? 'aktif' : 'pasif'}`);
});

process.on('SIGINT', () => {
  console.log('\n⚡ Server shutting down...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});