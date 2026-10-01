# Juice Shop Login

A small Juice Shop-inspired login page created for CSCE 477 HW2-B. The page uses HTML, JavaScript, and basic Tailwind CSS utility classes. It demonstrates browser and server validation, generic authentication errors, rate limiting, and timing-safe password verification. The server uses Node's built-in `scrypt` password-based key derivation function, so the project has no installed runtime dependencies.

## Requirements

- Node.js 20 or newer

## Run locally

```bash
npm start
```

Open <http://127.0.0.1:3000>. The demonstration credentials are:

- Email: `student@example.com`
- Password: `SecurePass123!`

## Run the tests

```bash
npm test
```

The automated tests verify a valid login, server-side validation, and rejection of representative SQL-injection and XSS payloads.

## Security design

- Client-side checks provide immediate feedback, but the server repeats every important check.
- Password verification uses `scrypt` with a random salt and `timingSafeEqual`; a production service would persist the salt and derived hash, never plaintext.
- Responses use generic login errors to avoid account enumeration.
- Per-address rate limiting slows automated guessing.
- User input is never inserted into HTML and is never concatenated into a database query.

## Secure password handling example

The running demo uses Node's built-in `scrypt`. Another option is bcrypt: hash the password during registration and compare the submitted password with the stored hash during login.

```js
const bcrypt = require('bcrypt');

// During registration:
const passwordHash = await bcrypt.hash(password, 12);

// During login:
const passwordMatches = await bcrypt.compare(candidatePassword, passwordHash);
```

Store the hash, never the plaintext password. This is an illustrative snippet; bcrypt is not a dependency of the running demo.

## Scope

This is an educational login demonstration.
