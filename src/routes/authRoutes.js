const express = require('express');
const authController = require('../controllers/authController');
const { validateUserRegistration, validateUserLogin } = require('../middleware/validation');

const router = express.Router();

router.post('/register', validateUserRegistration, authController.register);
router.post('/login', validateUserLogin, authController.login);

module.exports = router;
