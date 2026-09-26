// routes/userRoutes.js
const express        = require('express');
const router         = express.Router();
const userController = require('../controllers/userController');
const { requireAuth } = require('../controllers/authController');

// GET  /users        - list all users (admin only)
router.get('/',     requireAuth, userController.listUsers);

// GET  /users/:id    - get single user
router.get('/:id',  requireAuth, userController.getUser);

// POST /users        - create user (admin only)
router.post('/',    requireAuth, userController.createUser);

// PUT  /users/:id    - update user
router.put('/:id',  requireAuth, userController.updateUser);

// DELETE /users/:id  - soft-delete user (sets active=false)
router.delete('/:id', requireAuth, userController.deleteUser);

module.exports = router;
