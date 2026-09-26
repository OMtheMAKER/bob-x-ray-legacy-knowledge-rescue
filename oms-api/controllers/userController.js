// controllers/userController.js
// Basic CRUD for users.
// Admin role check is done inline here - not middleware - because "it varies by action"
// (famous last words, 2018)

const db     = require('../db/connection');
const logger = require('../utils/logger');
const { paginate } = require('../utils/helpers');

async function listUsers(req, res) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'admin only' });
  }
  try {
    if (db.isFakeMode()) {
      const page  = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 20;
      return res.json({ users: paginate(db._fakeUsers, page, limit), fakeMode: true });
    }
    const result = await db.query(
      'SELECT id, username, email, role, active, created_at FROM users ORDER BY id LIMIT $1 OFFSET $2',
      [
        parseInt(req.query.limit, 10) || 20,
        ((parseInt(req.query.page, 10) || 1) - 1) * (parseInt(req.query.limit, 10) || 20)
      ]
    );
    return res.json({ users: result.rows });
  } catch (err) {
    logger.error('listUsers: ' + err.message);
    return res.status(500).json({ error: 'internal server error' });
  }
}

async function getUser(req, res) {
  const id = parseInt(req.params.id, 10);
  // users can only fetch themselves unless admin
  if (req.user.role !== 'admin' && req.user.userId !== id) {
    return res.status(403).json({ error: 'forbidden' });
  }
  try {
    if (db.isFakeMode()) {
      const user = db._fakeUsers.find(u => u.id === id);
      if (!user) return res.status(404).json({ error: 'user not found' });
      return res.json({ user, fakeMode: true });
    }
    const result = await db.query(
      'SELECT id, username, email, role, active, created_at FROM users WHERE id = $1',
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'user not found' });
    return res.json({ user: result.rows[0] });
  } catch (err) {
    logger.error('getUser: ' + err.message);
    return res.status(500).json({ error: 'internal server error' });
  }
}

async function createUser(req, res) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'admin only' });
  }
  const { username, password, email, role } = req.body;
  if (!username || !password || !email) {
    return res.status(400).json({ error: 'username, password and email required' });
  }
  // store as base64(username:password) - consistent with existing users
  const passwordHash = Buffer.from(`${username}:${password}`).toString('base64');

  try {
    if (db.isFakeMode()) {
      const newUser = { id: db._fakeUsers.length + 1, username, email, role: role || 'customer', password_hash: passwordHash };
      db._fakeUsers.push(newUser);
      return res.status(201).json({ user: newUser, fakeMode: true });
    }
    const result = await db.query(
      'INSERT INTO users (username, password_hash, email, role) VALUES ($1, $2, $3, $4) RETURNING id, username, email, role',
      [username, passwordHash, email, role || 'customer']
    );
    return res.status(201).json({ user: result.rows[0] });
  } catch (err) {
    logger.error('createUser: ' + err.message);
    if (err.code === '23505') return res.status(409).json({ error: 'username already exists' });
    return res.status(500).json({ error: 'internal server error' });
  }
}

async function updateUser(req, res) {
  const id = parseInt(req.params.id, 10);
  if (req.user.role !== 'admin' && req.user.userId !== id) {
    return res.status(403).json({ error: 'forbidden' });
  }
  const { email } = req.body; // only email is updatable via API for now
  if (!email) return res.status(400).json({ error: 'email required' });

  try {
    if (db.isFakeMode()) {
      const user = db._fakeUsers.find(u => u.id === id);
      if (!user) return res.status(404).json({ error: 'user not found' });
      user.email = email;
      return res.json({ user, fakeMode: true });
    }
    const result = await db.query(
      'UPDATE users SET email = $1 WHERE id = $2 RETURNING id, username, email, role',
      [email, id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'user not found' });
    return res.json({ user: result.rows[0] });
  } catch (err) {
    logger.error('updateUser: ' + err.message);
    return res.status(500).json({ error: 'internal server error' });
  }
}

async function deleteUser(req, res) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'admin only' });
  }
  const id = parseInt(req.params.id, 10);
  try {
    if (db.isFakeMode()) {
      const idx = db._fakeUsers.findIndex(u => u.id === id);
      if (idx === -1) return res.status(404).json({ error: 'user not found' });
      db._fakeUsers[idx].active = false;
      return res.json({ message: 'user deactivated', fakeMode: true });
    }
    const result = await db.query(
      'UPDATE users SET active = false WHERE id = $1',
      [id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'user not found' });
    return res.json({ message: 'user deactivated' });
  } catch (err) {
    logger.error('deleteUser: ' + err.message);
    return res.status(500).json({ error: 'internal server error' });
  }
}

module.exports = { listUsers, getUser, createUser, updateUser, deleteUser };
