import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import NotificationBell from './NotificationBell';
import './Navbar.css';

export default function Navbar() {
  const { user, logout } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="navbar-brand" onClick={() => setMobileOpen(false)}>
          ShopEase
        </Link>

        <button
          className="navbar-toggle"
          onClick={() => setMobileOpen((o) => !o)}
          aria-label="Toggle navigation"
        >
          ☰
        </button>

        <div className={mobileOpen ? 'navbar-links open' : 'navbar-links'}>
          <Link to="/products" className="nav-link" onClick={() => setMobileOpen(false)}>
            Products
          </Link>

          <Link to="/chat" className="nav-link nav-link-chat" onClick={() => setMobileOpen(false)}>
            💬 AI Chat
          </Link>

          {user ? (
            <>
              <div className="nav-bell">
                <NotificationBell />
              </div>
              {user.role === 'admin' ? (
                <Link to="/admin" className="nav-link nav-link-admin" onClick={() => setMobileOpen(false)}>
                  Admin Dashboard
                </Link>
              ) : (
                <>
                  <Link to="/wishlist" className="nav-link" onClick={() => setMobileOpen(false)}>
                    ❤️ Wishlist
                  </Link>
                  <Link to="/cart" className="nav-link" onClick={() => setMobileOpen(false)}>
                    Cart
                  </Link>
                  <Link to="/orders" className="nav-link" onClick={() => setMobileOpen(false)}>
                    Orders
                  </Link>
                </>
              )}
              <div className="navbar-user" ref={dropdownRef}>
                <button
                  className="user-btn"
                  onClick={() => setShowDropdown(!showDropdown)}
                >
                  Hi, {user.name}
                  <span className="user-caret">▼</span>
                </button>

                {showDropdown && (
                  <div className="user-dropdown">
                    <div className="user-email">{user.email}</div>
                    {user.role === 'admin' ? (
                      <Link
                        to="/admin"
                        className="dropdown-item"
                        onClick={() => { setShowDropdown(false); setMobileOpen(false); }}
                      >
                        ⚙️ Admin Dashboard
                      </Link>
                    ) : (
                      <>
                        <Link
                          to="/profile"
                          className="dropdown-item"
                          onClick={() => { setShowDropdown(false); setMobileOpen(false); }}
                        >
                          👤 Profile
                        </Link>
                        <Link
                          to="/orders"
                          className="dropdown-item"
                          onClick={() => { setShowDropdown(false); setMobileOpen(false); }}
                        >
                          📦 My Orders
                        </Link>
                      </>
                    )}
                    <button
                      onClick={() => {
                        setShowDropdown(false);
                        setMobileOpen(false);
                        logout();
                      }}
                      className="dropdown-item dropdown-logout"
                    >
                      🚪 Logout
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <Link to="/login" className="nav-link" onClick={() => setMobileOpen(false)}>Login</Link>
              <Link to="/register" className="nav-btn-register" onClick={() => setMobileOpen(false)}>
                Register
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
