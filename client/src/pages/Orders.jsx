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
      delivered: '#10b981',
      received: '#059669',
      cancelled: '#ef4444',
      refunded: '#6b7280',
    };
    return colors[status] || '#6b7280';
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
                      {order.status === 'received' ? '✓ RECEIVED' : order.status.toUpperCase()}
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