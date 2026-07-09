const express = require('express');
const router = express.Router();
const {
  registerUser,
  loginUser,
  logoutUser,
  getCurrentUser,
  changePassword,
  validateRegister,
  validateLogin,
  validateChangePassword,
} = require('../controllers/authController');
const {
  forgotPassword,
  resetPassword,
  validateForgotPassword,
  validateResetPassword
} = require('../controllers/passwordController');
const { protect } = require('../middleware/authMiddleware');

router.post('/register', validateRegister, registerUser);
router.post('/login', validateLogin, loginUser);
router.post('/logout', protect, logoutUser);
router.get('/me', protect, getCurrentUser);
router.put('/change-password', protect, validateChangePassword, changePassword);
router.post('/forgot-password', validateForgotPassword, forgotPassword);
router.post('/reset-password', validateResetPassword, resetPassword);

module.exports = router;
