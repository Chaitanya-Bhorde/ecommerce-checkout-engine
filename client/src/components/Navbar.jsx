import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import NotificationBell from './NotificationBell';

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

      <div style={{ display: 'flex', gap: '1.2rem', alignItems: 'center' }}>
        <Link to="/products" style={{
          color: '#374151',
          textDecoration: 'none',
          fontSize: '0.95rem',
          fontWeight: '500',
        }}>
          Products
        </Link>

        <Link to="/chat" style={{
          color: '#7c3aed',
          textDecoration: 'none',
          fontSize: '0.95rem',
          fontWeight: '600',
          padding: '0.35rem 0.75rem',
          background: '#f5f3ff',
          borderRadius: '8px',
          transition: 'all 0.2s',
        }}>
          💬 AI Chat
        </Link>

        {user ? (
          <>
            <NotificationBell />
            {user.role === 'admin' ? (
              <Link to="/admin" style={{
                color: '#4f46e5',
                textDecoration: 'none',
                fontSize: '0.9rem',
                fontWeight: '600',
                padding: '0.3rem 0.7rem',
                background: '#eef2ff',
                borderRadius: '8px',
              }}>
                Admin Dashboard
              </Link>
            ) : (
              <>
                <Link to="/wishlist" style={{
                  color: '#374151',
                  textDecoration: 'none',
                  fontSize: '0.95rem',
                  fontWeight: '500',
                }}>
                  ❤️ Wishlist
                </Link>
                <Link to="/cart" style={{
                  color: '#374151',
                  textDecoration: 'none',
                  fontSize: '0.95rem',
                  fontWeight: '500',
                }}>
                  Cart
                </Link>
                <Link to="/orders" style={{
                  color: '#374151',
                  textDecoration: 'none',
                  fontSize: '0.95rem',
                  fontWeight: '500',
                }}>
                  Orders
                </Link>
              </>
            )}
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
            {user.role === 'admin' ? (
              <span style={{
                fontSize: '0.8rem',
                color: '#7c3aed',
                fontWeight: '600',
                padding: '0.25rem 0.6rem',
                background: '#f5f3ff',
                border: '1px solid #ddd6fe',
                borderRadius: '9999px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}>
                + Admin
              </span>
            ) : (
              <span style={{
                fontSize: '0.8rem',
                color: '#059669',
                fontWeight: '600',
                padding: '0.25rem 0.6rem',
                background: '#d1fae5',
                border: '1px solid #a7f3d0',
                borderRadius: '9999px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}>
                + User
              </span>
            )}
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
                cursor: 'pointer',
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