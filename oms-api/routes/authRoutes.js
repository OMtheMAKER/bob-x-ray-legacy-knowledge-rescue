// routes/authRoutes.js
const express        = require('express');
const router         = express.Router();
const authController = require('../controllers/authController');

// POST /auth/login  - exchange username+password for a session token
router.post('/login',  authController.login);

// POST /auth/logout - invalidate a session token
router.post('/logout', authController.logout);

module.exports = router;
