import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pagination, setPagination] = useState({
    page: 1,
    pages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  });

  const fetchOrders = async (page = 1) => {
    try {
      setLoading(true);
      const res = await api.get(`/orders?page=${page}&limit=10`);
      setOrders(res.data.orders);
      setPagination(res.data.pagination);
    } catch (err) {
      setError('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handlePageChange = (newPage) => {
    fetchOrders(newPage);
  };

  const handleCancelOrder = async (orderId) => {
    if (!window.confirm('Are you sure you want to cancel this order?')) {
      return;
    }

    try {
      await api.put(`/orders/${orderId}/cancel`);
      // Refresh orders after cancellation
      fetchOrders(pagination.page);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to cancel order');
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: '#f59e0b',
      confirmed: '#3b82f6',
      processing: '#8b5cf6',
      shipped: '#06b6d4',
      out_for_delivery: '#f97316',
      delivered: '#10b981',
      received: '#059669',
      cancelled: '#ef4444',
      refunded: '#6b7280',
    };
    return colors[status] || '#6b7280';
  };

  const getStatusText = (status) => {
    const statusTexts = {
      pending: 'Pending',
      confirmed: 'Order Confirmed',
      processing: 'Processing',
      shipped: 'Shipped',
      out_for_delivery: 'Out for Delivery',
      delivered: 'Delivered',
      received: 'Received',
      cancelled: 'Cancelled',
      refunded: 'Refunded',
    };
    return statusTexts[status] || status;
  };

  if (loading) {
    return (
      <div className="orders-page">
        <div className="container">
          <div className="loading">Loading orders...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="orders-page">
        <div className="container">
          <div className="error-message">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="orders-page">
      <div className="container">
        <h1>My Orders</h1>

        {orders.length === 0 ? (
          <div className="no-orders">
            <p>You haven't placed any orders yet.</p>
            <Link to="/products" className="btn-primary">
              Start Shopping
            </Link>
          </div>
        ) : (
          <>
            <div className="orders-list">
              {orders.map((order) => (
                <div key={order._id} className="order-card">
                  <div className="order-header">
                    <div className="order-info">
                      <span className="order-id">Order #{order._id.slice(-8).toUpperCase()}</span>
                      <span className="order-date">
                        {new Date(order.createdAt).toLocaleDateString('en-IN', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </div>
                    <span
                      className="status-badge"
                      style={{ backgroundColor: getStatusColor(order.status) }}
                    >
                      {getStatusText(order.status)}
                    </span>
                  </div>

                  <div className="order-items-preview">
                    {order.items.slice(0, 3).map((item, index) => (
                      <div key={index} className="order-item-preview">
                        <span className="item-name">{item.name}</span>
                        <span className="item-qty">x{item.quantity}</span>
                      </div>
                    ))}
                    {order.items.length > 3 && (
                      <div className="more-items">+{order.items.length - 3} more items</div>
                    )}
                  </div>

                  <div className="order-footer">
                    <div className="order-total">
                      <strong>Total: ₹{order.total.toFixed(2)}</strong>
                    </div>
                    <div className="order-actions">
                      <Link to={`/order-confirmation/${order._id}`} className="btn-link">
                        View Details
                      </Link>
                      <a
                        href={`/api/invoice/${order._id}`}
                        className="btn-link"
                        download
                        rel="noopener noreferrer"
                        style={{ color: '#10b981' }}
                      >
                        📥 Download Receipt
                      </a>
                      {['pending', 'confirmed'].includes(order.status) && (
                        <button
                          onClick={() => handleCancelOrder(order._id)}
                          className="btn-cancel"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Delivery Progress Bar */}
                  {order.deliveryProgress > 0 && (
                    <div style={{ padding: '0 1.1rem 1.1rem' }}>
                      <div style={{ marginBottom: '0.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: '600', color: '#374151' }}>
                            Delivery Progress
                          </span>
                          <span style={{ fontSize: '0.85rem', fontWeight: '700', color: '#4f46e5' }}>
                            {order.deliveryProgress}%
                          </span>
                        </div>
                        <div style={{
                          width: '100%',
                          height: '8px',
                          backgroundColor: '#e5e7eb',
                          borderRadius: '9999px',
                          overflow: 'hidden',
                        }}>
                          <div style={{
                            width: `${order.deliveryProgress}%`,
                            height: '100%',
                            backgroundColor: getStatusColor(order.status),
                            borderRadius: '9999px',
                            transition: 'width 0.3s ease',
                          }} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {pagination.pages > 1 && (
              <div className="pagination">
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={!pagination.hasPrevPage}
                  className="btn-pagination"
                >
                  Previous
                </button>
                <span className="page-info">
                  Page {pagination.page} of {pagination.pages}
                </span>
                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={!pagination.hasNextPage}
                  className="btn-pagination"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}