import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDashboardData();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchDashboardData, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [statsRes, ordersRes] = await Promise.all([
        api.get('/admin/dashboard/stats'),
        api.get('/admin/orders?limit=5&page=1'),
      ]);
      setStats(statsRes.data);
      setRecentOrders(ordersRes.data.orders || []);
    } catch (err) {
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="admin-page">
        <div className="container">
          <div className="loading-spinner"></div>
          <p className="loading-text">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-page">
        <div className="container">
          <div className="error-message">{error}</div>
        </div>
      </div>
    );
  }

  const statCards = [
    {
      title: 'Total Revenue',
      value: `₹${stats?.revenue?.toFixed(2) || '0.00'}`,
      icon: '💰',
      color: '#10b981',
      trend: '+12.5%',
      link: '/admin/ledger'
    },
    {
      title: 'Total Orders',
      value: stats?.orders?.total || 0,
      icon: '📦',
      color: '#3b82f6',
      trend: '+8.2%',
      link: '/admin/orders'
    },
    {
      title: 'Total Customers',
      value: stats?.customers?.total || 0,
      icon: '👥',
      color: '#8b5cf6',
      trend: '+5.1%',
      link: '/admin/customers'
    },
    {
      title: 'Pending Orders',
      value: stats?.orders?.pending || 0,
      icon: '⏳',
      color: '#f59e0b',
      trend: 'Needs attention',
      link: '/admin/orders?status=pending'
    },
    {
      title: 'Total Products',
      value: stats?.products?.total || 0,
      icon: '🏷️',
      color: '#06b6d4',
      trend: `${stats?.products?.active || 0} active`,
      link: '/admin/products'
    },
    {
      title: 'Total Categories',
      value: stats?.categories?.total || 0,
      icon: '📂',
      color: '#ec4899',
      trend: `${stats?.categories?.active || 0} active`,
      link: '/admin/categories'
    },
  ];

  return (
    <div className="admin-page">
      <div className="container">
        <div className="admin-header">
          <div>
            <h1 className="admin-title">Admin Dashboard</h1>
            <p className="admin-subtitle">Welcome back! Here's what's happening with your store.</p>
          </div>
          <div className="admin-actions">
            <Link to="/admin/orders" className="btn-primary">
              Manage Orders
            </Link>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="stats-grid">
          {statCards.map((stat, index) => (
            <Link to={stat.link} key={index} className="stat-card">
              <div className="stat-icon" style={{ background: `${stat.color}20`, color: stat.color }}>
                {stat.icon}
              </div>
              <div className="stat-content">
                <p className="stat-title">{stat.title}</p>
                <p className="stat-value">{stat.value}</p>
                <p className="stat-trend" style={{ color: stat.color }}>
                  {stat.trend}
                </p>
              </div>
            </Link>
          ))}
        </div>

        {/* Recent Orders */}
        <div className="admin-section">
          <div className="section-header">
            <h2>Recent Orders</h2>
            <Link to="/admin/orders" className="btn-link">
              View All →
            </Link>
          </div>
          <div className="orders-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Customer</th>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Payment</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="no-data">
                      No orders found
                    </td>
                  </tr>
                ) : (
                  recentOrders.map((order) => (
                    <tr key={order._id}>
                      <td>
                        <span className="order-id">#{order._id.slice(-8)}</span>
                      </td>
                      <td>
                        <div className="customer-info">
                          <span className="customer-name">
                            {order.user?.name || 'N/A'}
                          </span>
                          <span className="customer-email">
                            {order.user?.email || 'N/A'}
                          </span>
                        </div>
                      </td>
                      <td>{new Date(order.createdAt).toLocaleDateString()}</td>
                      <td>
                        <span className="order-amount">₹{order.total.toFixed(2)}</span>
                      </td>
                      <td>
                        <span className={`status-badge status-${order.status}`}>
                          {order.status}
                        </span>
                      </td>
                      <td>
                        <span className="payment-method">
                          {order.payment?.method || 'N/A'}
                        </span>
                      </td>
                      <td>
                        <div className="action-buttons">
                          <Link
                            to={`/admin/orders/${order._id}`}
                            className="btn-icon"
                            title="View Details"
                          >
                            👁️
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="admin-section">
          <h2>Quick Actions</h2>
          <div className="quick-actions-grid">
            <Link to="/admin/products" className="quick-action-card">
              <span className="quick-action-icon">➕</span>
              <span className="quick-action-title">Add Product</span>
            </Link>
            <Link to="/admin/categories" className="quick-action-card">
              <span className="quick-action-icon">📂</span>
              <span className="quick-action-title">Add Category</span>
            </Link>
            <Link to="/admin/orders?status=pending" className="quick-action-card">
              <span className="quick-action-icon">📋</span>
              <span className="quick-action-title">View Pending Orders</span>
            </Link>
            <Link to="/admin/ledger" className="quick-action-card">
              <span className="quick-action-icon">📊</span>
              <span className="quick-action-title">View Financial Reports</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}