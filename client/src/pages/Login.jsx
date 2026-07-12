import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/products';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(form.email, form.password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

const cardStyle = {
  maxWidth: '420px',
  width: '100%',
  margin: '3.5rem auto',
  padding: '2rem',
  background: '#ffffff',
  borderRadius: '16px',
  border: '1px solid #e5e7eb',
  boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -2px rgb(0 0 0 / 0.05)',
};

const labelStyle = {
  display: 'block',
  marginBottom: '0.4rem',
  fontSize: '0.88rem',
  fontWeight: '600',
  color: '#374151',
};

const inputStyle = {
  width: '100%',
};

const primaryButtonStyle = {
  width: '100%',
  padding: '0.75rem',
  background: '#4f46e5',
  color: '#ffffff',
  border: 'none',
  borderRadius: '10px',
  fontSize: '0.95rem',
  fontWeight: '600',
  cursor: 'pointer',
};

  return (
    <div style={{
      minHeight: 'calc(100vh - 65px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.5rem',
      background: '#f8fafc',
    }}>
      <div style={cardStyle}>
        <h1 style={{
          textAlign: 'center',
          marginBottom: '1.75rem',
          fontSize: '1.6rem',
          fontWeight: '700',
          color: '#111827',
        }}>
          Welcome back
        </h1>

        {error && (
          <div style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#b91c1c',
            padding: '0.75rem 1rem',
            borderRadius: '10px',
            marginBottom: '1.25rem',
            fontSize: '0.9rem',
            fontWeight: '500',
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
          <div>
            <label style={labelStyle}>Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
              style={inputStyle}
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label style={labelStyle}>Password</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              style={inputStyle}
              placeholder="Enter your password"
            />
          </div>

          <button type="submit" disabled={submitting} style={primaryButtonStyle}>
            {submitting ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <p style={{
          textAlign: 'center',
          marginTop: '1.25rem',
          fontSize: '0.9rem',
          color: '#6b7280',
        }}>
          Don't have an account?{' '}
          <Link to="/register" style={{ fontWeight: '600' }}>
            Create one
          </Link>
        </p>
        
        <p style={{
          textAlign: 'center',
          marginTop: '0.75rem',
          fontSize: '0.9rem',
          color: '#6b7280',
        }}>
          <Link to="/forgot-password" style={{ fontWeight: '600', color: '#4f46e5' }}>
            Forgot Password?
          </Link>
        </p>
      </div>
    </div>
  );
}
