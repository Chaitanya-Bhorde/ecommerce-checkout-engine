import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import NotificationBell from './NotificationBell';

export default function Navbar() {
  const { user, logout } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);

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
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                style={{
                  fontSize: '0.9rem',
                  color: '#4b5563',
                  fontWeight: '500',
                  padding: '0.35rem 0.75rem',
                  background: '#f3f4f6',
                  border: 'none',
                  borderRadius: '9999px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                Hi, {user.name}
                <span style={{ fontSize: '0.7rem' }}>▼</span>
              </button>
              
              {showDropdown && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '0.5rem',
                  background: '#ffffff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  minWidth: '180px',
                  zIndex: 1000,
                }}>
                  <div style={{
                    padding: '0.75rem 1rem',
                    borderBottom: '1px solid #e5e7eb',
                    fontSize: '0.85rem',
                    color: '#6b7280',
                  }}>
                    {user.email}
                  </div>
                  {user.role === 'admin' ? (
                    <Link
                      to="/admin"
                      style={{
                        display: 'block',
                        padding: '0.75rem 1rem',
                        color: '#374151',
                        textDecoration: 'none',
                        fontSize: '0.9rem',
                        borderBottom: '1px solid #f3f4f6',
                      }}
                      onClick={() => setShowDropdown(false)}
                    >
                      ⚙️ Admin Dashboard
                    </Link>
                  ) : (
                    <>
                      <Link
                        to="/profile"
                        style={{
                          display: 'block',
                          padding: '0.75rem 1rem',
                          color: '#374151',
                          textDecoration: 'none',
                          fontSize: '0.9rem',
                          borderBottom: '1px solid #f3f4f6',
                        }}
                        onClick={() => setShowDropdown(false)}
                      >
                        👤 Profile
                      </Link>
                      <Link
                        to="/orders"
                        style={{
                          display: 'block',
                          padding: '0.75rem 1rem',
                          color: '#374151',
                          textDecoration: 'none',
                          fontSize: '0.9rem',
                          borderBottom: '1px solid #f3f4f6',
                        }}
                        onClick={() => setShowDropdown(false)}
                      >
                        📦 My Orders
                      </Link>
                    </>
                  )}
                  <button
                    onClick={() => {
                      setShowDropdown(false);
                      logout();
                    }}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '0.75rem 1rem',
                      color: '#dc2626',
                      background: 'none',
                      border: 'none',
                      fontSize: '0.9rem',
                      cursor: 'pointer',
                    }}
                  >
                    🚪 Logout
                  </button>
                </div>
              )}
            </div>
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