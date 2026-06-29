import { useState, useEffect } from 'react';
import { api } from '../services/api';

export default function AdminCustomers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      const res = await api.get('/admin/customers');
      setCustomers(res.data.customers || []);
    } catch (err) {
      setError('Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (customerId) => {
    try {
      const res = await api.get(`/admin/customers/${customerId}`);
      setSelectedCustomer(res.data);
    } catch (err) {
      alert('Failed to load customer details');
    }
  };

  const closeModal = () => {
    setSelectedCustomer(null);
  };

  if (loading) {
    return (
      <div className="admin-page">
        <div className="container">
          <div className="loading-spinner"></div>
          <p className="loading-text">Loading customers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="container">
        <div className="admin-header">
          <div>
            <h1 className="admin-title">Customer Management</h1>
            <p className="admin-subtitle">View and manage customer accounts</p>
          </div>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {/* Customers Table */}
        <div className="admin-section">
          <div className="customers-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Joined</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {customers.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="no-data">
                      No customers found
                    </td>
                  </tr>
                ) : (
                  customers.map((customer) => (
                    <tr key={customer._id}>
                      <td>
                        <div className="customer-info">
                          <span className="customer-name">{customer.name}</span>
                        </div>
                      </td>
                      <td>
                        <span className="customer-email">{customer.email}</span>
                      </td>
                      <td>
                        <span className={`role-badge role-${customer.role}`}>
                          {customer.role}
                        </span>
                      </td>
                      <td>{new Date(customer.createdAt).toLocaleDateString()}</td>
                      <td>
                        <div className="action-buttons">
                          <button
                            onClick={() => handleViewDetails(customer._id)}
                            className="btn-icon"
                            title="View Details"
                          >
                            👁️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Customer Details Modal */}
        {selectedCustomer && (
          <div className="modal-overlay" onClick={closeModal}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Customer Details</h2>
                <button className="modal-close" onClick={closeModal}>✕</button>
              </div>
              <div className="modal-body">
                <div className="customer-detail-section">
                  <h3>Customer Information</h3>
                  <div className="detail-grid">
                    <div className="detail-item">
                      <span className="detail-label">Name:</span>
                      <span className="detail-value">{selectedCustomer.name}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Email:</span>
                      <span className="detail-value">{selectedCustomer.email}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Role:</span>
                      <span className={`role-badge role-${selectedCustomer.role}`}>
                        {selectedCustomer.role}
                      </span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Joined:</span>
                      <span className="detail-value">
                        {new Date(selectedCustomer.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>

                {selectedCustomer.orderStats && (
                  <div className="customer-detail-section">
                    <h3>Order Statistics</h3>
                    <div className="stats-grid-small">
                      <div className="stat-card-small">
                        <span className="stat-label">Total Orders</span>
                        <span className="stat-value">{selectedCustomer.orderStats.totalOrders}</span>
                      </div>
                      <div className="stat-card-small">
                        <span className="stat-label">Total Spent</span>
                        <span className="stat-value">₹{selectedCustomer.orderStats.totalSpent.toFixed(2)}</span>
                      </div>
                      <div className="stat-card-small">
                        <span className="stat-label">Last Order</span>
                        <span className="stat-value">
                          {selectedCustomer.orderStats.lastOrderDate 
                            ? new Date(selectedCustomer.orderStats.lastOrderDate).toLocaleDateString()
                            : 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {selectedCustomer.recentOrders && selectedCustomer.recentOrders.length > 0 && (
                  <div className="customer-detail-section">
                    <h3>Recent Orders</h3>
                    <div className="recent-orders-list">
                      {selectedCustomer.recentOrders.map((order) => (
                        <div key={order._id} className="recent-order-item">
                          <div className="order-info">
                            <span className="order-id">#{order._id.slice(-8)}</span>
                            <span className="order-date">{new Date(order.createdAt).toLocaleDateString()}</span>
                          </div>
                          <div className="order-details">
                            <span className="order-amount">₹{order.total.toFixed(2)}</span>
                            <span className={`status-badge status-${order.status}`}>
                              {order.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}