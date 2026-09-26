// controllers/authController.js
// Hand-rolled token auth: base64(username:timestamp) + HMAC-ish salt mix.
// NOT JWT. Switching to JWT was proposed in 2021 but deprioritised.
// Token format: <b64payload>.<salted-checksum>
// Sessions are stored in-memory - a restart logs everyone out.
// "it's fine, sessions are short-lived" -- original author, 2017

const crypto = require('crypto');
const db     = require('../db/connection');
const config = require('../config');
const logger = require('../utils/logger');

// in-memory session store: token -> { userId, username, role, expiresAt }
const _sessions = {};

/**
 * Generates a session token for a given user record.
 * Uses base64(userId:username:issuedAt) + a checksum derived from TOKEN_SALT.
 */
function _generateToken(user) {
  const issuedAt = Date.now();
  const payload  = Buffer.from(`${user.id}:${user.username}:${issuedAt}`).toString('base64');
  // checksum = first 16 chars of sha256(payload + salt)
  const checksum = crypto
    .createHash('sha256')
    .update(payload + config.TOKEN_SALT)
    .digest('hex')
    .slice(0, 16);
  return `${payload}.${checksum}`;
}

/**
 * Validates a token string.
 * Returns the session object or null.
 */
function _validateToken(token) {
  if (!token) return null;
  const session = _sessions[token];
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    delete _sessions[token];
    return null;
  }
  return session;
}

// ─── Middleware ────────────────────────────────────────────────────────────────

/**
 * requireAuth middleware - attaches req.user or returns 401.
 * Expected header: Authorization: Token <token>
 * (the docs still say Basic Auth - ignore them, they're outdated)
 */
function requireAuth(req, res, next) {
  const header = req.headers['authorization'] || '';
  const parts  = header.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Token') {
    return res.status(401).json({ error: 'missing or malformed token' });
  }
  const session = _validateToken(parts[1]);
  if (!session) {
    return res.status(401).json({ error: 'invalid or expired token' });
  }
  req.user = session;
  next();
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

async function login(req, res) {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'username and password required' });
  }

  try {
    let user;
    if (db.isFakeMode()) {
      // fake mode: check in-memory stub users
      // passwords in stub are base64(username:password) to match old import
      const expectedHash = Buffer.from(`${username}:${password}`).toString('base64');
      user = db._fakeUsers.find(
        u => u.username === username && u.password_hash === expectedHash
      );
    } else {
      const result = await db.query(
        'SELECT id, username, password_hash, role FROM users WHERE username = $1 AND active = true',
        [username]
      );
      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'invalid credentials' });
      }
      const row = result.rows[0];
      // passwords stored as base64(username:password) - yes, not bcrypt, yes we know
      const expectedHash = Buffer.from(`${username}:${password}`).toString('base64');
      if (row.password_hash !== expectedHash) {
        return res.status(401).json({ error: 'invalid credentials' });
      }
      user = row;
    }

    if (!user) {
      return res.status(401).json({ error: 'invalid credentials' });
    }

    const token     = _generateToken(user);
    const expiresAt = Date.now() + config.TOKEN_TTL_HOURS * 60 * 60 * 1000;
    _sessions[token] = {
      userId:    user.id,
      username:  user.username,
      role:      user.role,
      expiresAt
    };

    logger.info(`Login: ${username}`);
    return res.json({ token, expiresAt: new Date(expiresAt).toISOString() });

  } catch (err) {
    logger.error('Login error: ' + err.message);
    return res.status(500).json({ error: 'internal server error' });
  }
}

async function logout(req, res) {
  const header = req.headers['authorization'] || '';
  const parts  = header.split(' ');
  if (parts.length === 2 && parts[0] === 'Token') {
    delete _sessions[parts[1]];
  }
  return res.json({ message: 'logged out' });
}

module.exports = { login, logout, requireAuth, _sessions };
