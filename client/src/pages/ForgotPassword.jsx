import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import './ForgotPassword.css';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [devToken, setDevToken] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setDevToken('');
    setLoading(true);

    try {
      const res = await api.post('/auth/forgot-password', { email });

      setSuccess(res.data?.message || 'If an account with that email exists, we have sent a password reset link');

      // Development only: backend returns the raw token because there is no
      // email transport in dev. Never present in production responses.
      if (res.data?.devOnly && res.data?.resetToken) {
        setDevToken(res.data.resetToken);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to process request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="forgot-password-container">
      <div className="forgot-password-card">
        <h2>Forgot Password</h2>
        <p className="subtitle">Enter your email to receive a password reset link</p>

        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        {devToken && (
          <div className="alert alert-info">
            <p><strong>Development mode:</strong> email delivery is not configured, use this reset link:</p>
            <Link to={`/reset-password?token=${devToken}`}>Open reset page with token</Link>
          </div>
        )}

        <form onSubmit={handleSubmit} className="forgot-password-form">
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your registered email"
              required
            />
          </div>

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Sending...' : 'Send Reset Link'}
          </button>
        </form>

        <div className="back-to-login">
          <Link to="/login">Back to Login</Link>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;

