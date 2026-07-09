const User = require('../models/User');
const crypto = require('crypto');
const Notification = require('../models/Notification');
const { body, validationResult } = require('express-validator');

// Generate reset token
const generateResetToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

// Forgot password - send reset email
const forgotPassword = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        message: 'Validation failed',
        errors: errors.array() 
      });
    }

    const { email } = req.body;
    const user = await User.findOne({ email });

    // Don't reveal if user exists or not (security best practice)
    if (!user) {
      return res.json({
        success: true,
        message: 'If an account with that email exists, we have sent a password reset link'
      });
    }

    // Generate reset token
    const resetToken = generateResetToken();
    const resetTokenExpiry = Date.now() + 3600000; // 1 hour

    // Save token to user
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpiry = resetTokenExpiry;
    await user.save();

    // Send notification (in production, send email)
    try {
      await Notification.create({
        userId: user._id,
        type: 'general',
        title: 'Password Reset Request',
        message: `Password reset requested. Use this token: ${resetToken}. This token expires in 1 hour.`,
        data: { 
          userId: user._id, 
          resetToken,
          expiresAt: resetTokenExpiry
        },
      });
    } catch (notifError) {
      console.error('Error creating password reset notification:', notifError);
    }

    res.json({
      success: true,
      message: 'If an account with that email exists, we have sent a password reset link',
      // In development, return the token (remove in production)
      ...(process.env.NODE_ENV === 'development' && { resetToken })
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Reset password with token
const resetPassword = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        message: 'Validation failed',
        errors: errors.array() 
      });
    }

    const { token, password } = req.body;

    // Find user with valid token
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpiry: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid or expired reset token' 
      });
    }

    // Update password
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpiry = undefined;
    await user.save();

    // Send notification
    try {
      await Notification.create({
        userId: user._id,
        type: 'general',
        title: 'Password Reset Successful',
        message: 'Your password has been reset successfully',
        data: { userId: user._id },
      });
    } catch (notifError) {
      console.error('Error creating password reset notification:', notifError);
    }

    res.json({
      success: true,
      message: 'Password reset successful'
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Validation rules
const validateForgotPassword = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email')
];

const validateResetPassword = [
  body('token')
    .notEmpty()
    .withMessage('Reset token is required'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters')
    .matches(/\d/)
    .withMessage('Password must contain at least one number')
];

module.exports = {
  forgotPassword,
  resetPassword,
  validateForgotPassword,
  validateResetPassword
};