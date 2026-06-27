import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();

  return (
    <nav style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '0.9rem 2rem',
      borderBottom: '1px solid #e5e7eb',
      background: '#ffffff',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)',
    }}>
      <Link to="/" style={{
        fontSize: '1.4rem',
        fontWeight: '700',
        color: '#4f46e5',
        textDecoration: 'none',
        letterSpacing: '-0.025em',
      }}>
        ShopEase
      </Link>

      <div style={{ display: 'flex', gap: '1.75rem', alignItems: 'center' }}>
        <Link to="/products" style={{
          color: '#374151',
          textDecoration: 'none',
          fontSize: '0.95rem',
          fontWeight: '500',
          transition: 'color 0.2s',
        }}>
          Products
        </Link>
        <Link to="/cart" style={{
          color: '#374151',
          textDecoration: 'none',
          fontSize: '0.95rem',
          fontWeight: '500',
          position: 'relative',
          transition: 'color 0.2s',
        }}>
          Cart
        </Link>

        {user ? (
          <>
            <span style={{
              fontSize: '0.9rem',
              color: '#4b5563',
              fontWeight: '500',
              padding: '0.35rem 0.75rem',
              background: '#f3f4f6',
              borderRadius: '9999px',
            }}>
              Hi, {user.name}
            </span>
            <button
              onClick={logout}
              style={{
                padding: '0.5rem 1.1rem',
                fontSize: '0.9rem',
                fontWeight: '500',
                color: '#374151',
                background: '#ffffff',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
              }}
            >
              Logout
            </button>
          </>
        ) : (
          <>
            <Link to="/login" style={{
              color: '#374151',
              textDecoration: 'none',
              fontSize: '0.95rem',
              fontWeight: '500',
            }}>Login</Link>
            <Link to="/register" style={{
              padding: '0.5rem 1.1rem',
              background: '#4f46e5',
              color: '#ffffff',
              borderRadius: '8px',
              textDecoration: 'none',
              fontSize: '0.9rem',
              fontWeight: '500',
            }}>
              Register
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
