import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createRequire } from 'node:module';
import { once } from 'node:events';

const require = createRequire(import.meta.url);
process.env.PORT = '0';
const { start, validationError } = require('../server.js');
let server;
let baseUrl;

before(async () => {
  server = await start();
  if (!server.listening) await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});
after(() => new Promise((resolve, reject) => {
  server.close((error) => error ? reject(error) : resolve());
}));

test('server-side validation rejects malformed credentials', () => {
  assert.equal(validationError('not-an-email', 'short'), 'Enter a valid email address.');
  assert.equal(validationError('user@example.com', 'short'), 'Password must be at least 8 characters.');
});

test('null JSON returns a validation error', async () => {
  const response = await fetch(`${baseUrl}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: 'null',
  });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    ok: false, message: 'Email and password must be text.',
  });
});

test('only the page and its script are served', async () => {
  for (const [path, contentType] of [
    ['/', 'text/html; charset=utf-8'],
    ['/index.html', 'text/html; charset=utf-8'],
    ['/app.js', 'text/javascript; charset=utf-8'],
  ]) {
    const response = await fetch(`${baseUrl}${path}`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), contentType);
    assert.ok((await response.text()).length > 0);
  }
  for (const path of ['/server.js', '/package.json', '/missing', '/..%5Cserver.js']) {
    const response = await fetch(`${baseUrl}${path}`);
    assert.equal(response.status, 404);
    await response.text();
  }
});

test('valid demo credentials authenticate', async () => {
  const response = await fetch(`${baseUrl}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'student@example.com', password: 'SecurePass123!' }),
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).ok, true);
});

test('SQL injection payload cannot bypass authentication', async () => {
  const response = await fetch(`${baseUrl}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: "admin@example.com' OR 1=1--@x", password: 'anything123' }),
  });
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { ok: false, message: 'Invalid email or password.' });
});

test('XSS payload is rejected as credentials and never reflected', async () => {
  const payload = '<img src=x onerror=alert(1)>@example.com';
  const response = await fetch(`${baseUrl}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: payload, password: 'anything123' }),
  });
  const text = await response.text();
  assert.equal(response.status, 401);
  assert.equal(text.includes(payload), false);
});
