const http = require('node:http');
const { readFile } = require('node:fs/promises');
const { join } = require('node:path');
const { promisify } = require('node:util');
const { randomBytes, scrypt, timingSafeEqual } = require('node:crypto');

const scryptAsync = promisify(scrypt);
const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = join(__dirname, 'public');
const MAX_BODY_BYTES = 8 * 1024;
const LOGIN_WINDOW_MS = 60_000;
const LOGIN_LIMIT = 8;
const attemptsByAddress = new Map();

const demoAccount = {
  email: 'student@example.com',
  salt: randomBytes(16),
  passwordHash: null,
};

function json(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer',
  });
  res.end(JSON.stringify(body));
}

function validationError(email, password) {
  if (typeof email !== 'string' || typeof password !== 'string') {
    return 'Email and password must be text.';
  }
  if (!email.trim() || !password) return 'Email and password are required.';
  if (email.length > 254 || password.length > 128) return 'Input is too long.';
  if (!email.includes('@')) return 'Enter a valid email address.';
  if (password.length < 8) return 'Password must be at least 8 characters.';
  return null;
}

function limited(address) {
  const now = Date.now();
  const recent = (attemptsByAddress.get(address) || []).filter(
    (timestamp) => now - timestamp < LOGIN_WINDOW_MS,
  );
  if (recent.length >= LOGIN_LIMIT) return true;
  recent.push(now);
  attemptsByAddress.set(address, recent);
  return false;
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new Error('REQUEST_TOO_LARGE');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

async function handleLogin(req, res) {
  if (limited(req.socket.remoteAddress || 'unknown')) {
    return json(res, 429, { ok: false, message: 'Too many attempts. Try again later.' });
  }

  let body;
  try {
    body = await readJson(req);
  } catch (error) {
    const status = error.message === 'REQUEST_TOO_LARGE' ? 413 : 400;
    return json(res, status, { ok: false, message: 'Invalid request.' });
  }

  const error = validationError(body?.email, body?.password);
  if (error) return json(res, 400, { ok: false, message: error });

  const candidate = await scryptAsync(body.password, demoAccount.salt, 64);
  const emailMatches = body.email.trim().toLowerCase() === demoAccount.email;
  const passwordMatches = timingSafeEqual(candidate, demoAccount.passwordHash);

  if (!emailMatches || !passwordMatches) {
    return json(res, 401, { ok: false, message: 'Invalid email or password.' });
  }

  return json(res, 200, { ok: true, message: 'Login successful.' });
}

async function serveStatic(pathname, res) {
  let filename;
  let contentType;
  if (pathname === '/' || pathname === '/index.html') {
    filename = 'index.html';
    contentType = 'text/html; charset=utf-8';
  } else if (pathname === '/app.js') {
    filename = 'app.js';
    contentType = 'text/javascript; charset=utf-8';
  } else {
    return json(res, 404, { message: 'Not found.' });
  }

  try {
    const content = await readFile(join(PUBLIC_DIR, filename));
    res.writeHead(200, {
      'Content-Type': contentType,
      'Referrer-Policy': 'no-referrer',
    });
    res.end(content);
  } catch {
    json(res, 404, { message: 'Not found.' });
  }
}

async function requestHandler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (req.method === 'POST' && url.pathname === '/api/login') {
    return handleLogin(req, res);
  }
  if (req.method === 'GET') return serveStatic(url.pathname, res);
  return json(res, 405, { message: 'Method not allowed.' });
}

async function start() {
  demoAccount.passwordHash = await scryptAsync('SecurePass123!', demoAccount.salt, 64);
  const server = http.createServer((req, res) => {
    requestHandler(req, res).catch(() => {
      if (!res.headersSent) json(res, 500, { ok: false, message: 'Internal server error.' });
    });
  });
  server.listen(PORT, '127.0.0.1', () => {
    console.log(`Secure login running at http://127.0.0.1:${server.address().port}`);
  });
  return server;
}

if (require.main === module) start();

module.exports = { start, validationError };
