const User = require('../models/User');
const crypto = require('crypto');
const Notification = require('../models/Notification');
const { body, validationResult } = require('express-validator');

const generateResetToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

// Tokens are stored only as SHA-256 hashes — a DB leak cannot be used to reset
// anyone's password.
const hashResetToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

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

    // Generic response regardless of account existence (no enumeration oracle)
    const genericResponse = {
      success: true,
      message: 'If an account with that email exists, we have sent a password reset link'
    };

    if (!user) {
      return res.json(genericResponse);
    }

    const resetToken = generateResetToken();
    // `resetPasswordExpiry` is a Date path in the schema: always store and
    // compare Date values. Mixing numeric epoch milliseconds with a Date-typed
    // field made every stored token un-matchable (Mongoose casts the number to
    // a Date, and MongoDB never compares a Date against a numeric bound).
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000);

    user.resetPasswordToken = hashResetToken(resetToken);
    user.resetPasswordExpiry = resetTokenExpiry;
    await user.save();

    try {
      await Notification.create({
        userId: user._id,
        type: 'general',
        title: 'Password Reset Request',
        message: 'A password reset was requested for your account. The reset link expires in 1 hour.',
        data: { 
          userId: user._id, 
          expiresAt: resetTokenExpiry
        },
      });
    } catch (notifError) {
      console.error('Error creating password reset notification:', notifError);
    }

    // Raw token is NEVER exposed in production. In development only, it is
    // returned explicitly for testing because there is no email transport.
    if (process.env.NODE_ENV === 'development') {
      return res.json({ ...genericResponse, resetToken, devOnly: true });
    }

    res.json(genericResponse);
  } catch (error) {
    console.error('Forgot password error:', error.message);
    res.status(500).json({ message: 'An error occurred while processing your request' });
  }
};

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
    const hashedToken = hashResetToken(token);

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpiry: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid or expired reset token' 
      });
    }

    // Atomically invalidate the token BEFORE changing the password so the
    // token is strictly single-use even under concurrent requests.
    const invalidated = await User.updateOne(
      {
        _id: user._id,
        resetPasswordToken: hashedToken,
        resetPasswordExpiry: { $gt: new Date() }
      },
      { $unset: { resetPasswordToken: '', resetPasswordExpiry: '' } }
    );

    if (invalidated.modifiedCount === 0) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid or expired reset token' 
      });
    }

    user.password = password; // hashed by the User model pre-save hook
    await user.save();

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
    console.error('Reset password error:', error.message);
    res.status(500).json({ message: 'An error occurred while processing your request' });
  }
};

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
