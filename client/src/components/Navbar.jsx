import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import NotificationBell from './NotificationBell';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { lang, toggleLang, t } = useLanguage();
  const { darkMode, toggleDarkMode } = useTheme();

  return (
    <nav style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '0.9rem 2rem',
      borderBottom: '1px solid var(--border-color, #e5e7eb)',
      background: 'var(--nav-bg, #ffffff)',
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
        {t('app.name')}
      </Link>

      <div style={{ display: 'flex', gap: '1.2rem', alignItems: 'center' }}>
        <Link to="/products" style={{
          color: 'var(--text-color, #374151)',
          textDecoration: 'none',
          fontSize: '0.95rem',
          fontWeight: '500',
        }}>
          {t('nav.products')}
        </Link>

        {/* Language Toggle */}
        <button onClick={toggleLang} style={{
          background: 'var(--btn-bg, #f3f4f6)',
          border: '1px solid var(--border-color, #e5e7eb)',
          borderRadius: '8px',
          padding: '0.35rem 0.7rem',
          cursor: 'pointer',
          fontSize: '0.85rem',
          fontWeight: '600',
          color: 'var(--text-color, #374151)',
        }}>
          {lang === 'en' ? 'हिंदी' : 'English'}
        </button>

        {/* Dark Mode Toggle */}
        <button onClick={toggleDarkMode} style={{
          background: 'var(--btn-bg, #f3f4f6)',
          border: '1px solid var(--border-color, #e5e7eb)',
          borderRadius: '8px',
          padding: '0.35rem 0.7rem',
          cursor: 'pointer',
          fontSize: '1rem',
        }}>
          {darkMode ? '☀️' : '🌙'}
        </button>

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
          💬 {t('nav.chat')}
        </Link>

        {user ? (
          <>
            <NotificationBell />
            {user.role === 'admin' ? (
              <>
                <Link to="/admin" style={{
                  color: '#4f46e5',
                  textDecoration: 'none',
                  fontSize: '0.9rem',
                  fontWeight: '600',
                  padding: '0.3rem 0.7rem',
                  background: '#eef2ff',
                  borderRadius: '8px',
                }}>
                  {t('admin.dashboard')}
                </Link>
                <Link to="/admin/ai-analytics" style={{
                  color: '#7c3aed',
                  textDecoration: 'none',
                  fontSize: '0.9rem',
                  fontWeight: '600',
                  padding: '0.3rem 0.7rem',
                  background: '#f5f3ff',
                  borderRadius: '8px',
                }}>
                  {t('admin.analytics')}
                </Link>
              </>
            ) : (
              <>
                <Link to="/wishlist" style={{
                  color: '#374151',
                  textDecoration: 'none',
                  fontSize: '0.95rem',
                  fontWeight: '500',
                }}>
                  ❤️ {t('product.addToWishlist')}
                </Link>
                <Link to="/cart" style={{
                  color: '#374151',
                  textDecoration: 'none',
                  fontSize: '0.95rem',
                  fontWeight: '500',
                }}>
                  {t('nav.cart')}
                </Link>
                <Link to="/orders" style={{
                  color: '#374151',
                  textDecoration: 'none',
                  fontSize: '0.95rem',
                  fontWeight: '500',
                }}>
                  {t('nav.orders')}
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
              {t('nav.hello')}, {user.name}
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
              {t('nav.logout')}
            </button>
          </>
        ) : (
          <>
            <Link to="/login" style={{
              color: '#374151',
              textDecoration: 'none',
              fontSize: '0.95rem',
              fontWeight: '500',
            }}>{t('nav.login')}</Link>
            <Link to="/register" style={{
              padding: '0.5rem 1.1rem',
              background: '#4f46e5',
              color: '#ffffff',
              borderRadius: '8px',
              textDecoration: 'none',
              fontSize: '0.9rem',
              fontWeight: '500',
            }}>
              {t('nav.register')}
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}