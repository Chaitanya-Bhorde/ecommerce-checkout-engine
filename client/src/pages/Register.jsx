import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await register(form.name, form.email, form.password);
      navigate('/products');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
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
          Create account
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
            <label style={labelStyle}>Full name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              style={inputStyle}
              placeholder="John Doe"
            />
          </div>

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
              minLength={6}
              style={inputStyle}
              placeholder="At least 6 characters"
            />
          </div>

          <button type="submit" disabled={submitting} style={primaryButtonStyle}>
            {submitting ? 'Creating account...' : 'Register'}
          </button>
        </form>

        <p style={{
          textAlign: 'center',
          marginTop: '1.25rem',
          fontSize: '0.9rem',
          color: '#6b7280',
        }}>
          Already have an account?{' '}
          <Link to="/login" style={{ fontWeight: '600' }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
