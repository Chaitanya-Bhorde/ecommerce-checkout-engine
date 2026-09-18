import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './Profile.css';

const Profile = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    
    const timer = setTimeout(() => {
      setLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return (
      <div className="profile-page">
        <div className="container">
          <div className="loading-spinner"></div>
          <p className="loading-text">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <div className="container">
        <div className="profile-card">
          <div className="profile-header">
            <div className="profile-avatar">
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <h1 className="profile-title">My Profile</h1>
          </div>

          <div className="profile-content">
            <div className="profile-info">
              <div className="info-item">
                <div className="info-label">
                  <span className="info-icon">👤</span>
                  Full Name
                </div>
                <div className="info-value">{user?.name || 'N/A'}</div>
              </div>

              <div className="info-item">
                <div className="info-label">
                  <span className="info-icon">📧</span>
                  Email Address
                </div>
                <div className="info-value">{user?.email || 'N/A'}</div>
              </div>

              <div className="info-item">
                <div className="info-label">
                  <span className="info-icon">🔑</span>
                  Account Type
                </div>
                <div className="info-value">
                  <span className={`role-badge ${user?.role || 'user'}`}>
                    {user?.role === 'admin' ? 'Administrator' : 'Customer'}
                  </span>
                </div>
              </div>

              <div className="info-item">
                <div className="info-label">
                  <span className="info-icon">🆔</span>
                  User ID
                </div>
                <div className="info-value user-id">{user?._id || 'N/A'}</div>
              </div>
            </div>

            <div className="profile-actions">
              <a href="/change-password" className="btn-primary">
                🔒 Change Password
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;