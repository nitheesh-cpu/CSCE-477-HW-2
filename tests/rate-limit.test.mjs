import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { once } from 'node:events';

const require = createRequire(import.meta.url);
process.env.PORT = '0';
const { start } = require('../server.js');

test('login allows eight attempts per minute and recovers after expiry', async () => {
  const server = await start();
  if (!server.listening) await once(server, 'listening');
  const url = `http://127.0.0.1:${server.address().port}/api/login`;
  const originalNow = Date.now;
  let now = originalNow();
  Date.now = () => now;
  try {
    for (let attempt = 1; attempt <= 10; attempt++) {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      assert.equal(response.status, attempt <= 8 ? 400 : 429);
      await response.text();
    }
    now += 60_000;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    assert.equal(response.status, 400);
    await response.text();
  } finally {
    Date.now = originalNow;
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
});
