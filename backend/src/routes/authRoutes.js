const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// POST /api/v1/auth/login to obtain a JWT token.
router.post('/login', authController.login);

module.exports = router;
