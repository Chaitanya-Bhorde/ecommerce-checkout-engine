import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../services/api';

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedOrder, setSelectedOrder] = useState(null);

  const currentPage = Number(searchParams.get('page')) || 1;
  const statusFilter = searchParams.get('status') || '';

  useEffect(() => {
    fetchOrders();
  }, [currentPage, statusFilter]);

  const fetchOrders = async () => {
    try {
      const params = { page: currentPage, limit: 20 };
      if (statusFilter) params.status = statusFilter;

      const res = await api.get('/admin/orders', { params });
      setOrders(res.data.orders || []);
      setPagination(res.data.pagination);
    } catch (err) {
      setError('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (orderId, newStatus) => {
    try {
      await api.put(`/admin/orders/${orderId}/status`, { status: newStatus });
      // Refresh orders list to show updated status
      await fetchOrders();
    } catch (err) {
      alert('Failed to update order status');
    }
  };

  const handleViewDetails = async (orderId) => {
    try {
      const res = await api.get(`/admin/orders/${orderId}`);
      setSelectedOrder(res.data);
    } catch (err) {
      alert('Failed to load order details');
    }
  };

  const closeModal = () => {
    setSelectedOrder(null);
  };

  if (loading) {
    return (
      <div className="admin-page">
        <div className="container">
          <div className="loading-spinner"></div>
          <p className="loading-text">Loading orders...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="container">
        <div className="admin-header">
          <div>
            <h1 className="admin-title">Order Management</h1>
            <p className="admin-subtitle">View and manage all customer orders</p>
          </div>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {/* Filters */}
        <div className="admin-section">
          <div className="filters-bar">
            <div className="filter-group">
              <label>Status Filter:</label>
              <select
                value={statusFilter}
                onChange={(e) => {
                  const newParams = statusFilter 
                    ? { page: '1' } 
                    : { page: currentPage.toString() };
                  if (e.target.value) newParams.status = e.target.value;
                  setSearchParams(newParams);
                }}
                className="filter-select"
              >
                <option value="">All Orders</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="processing">Processing</option>
                <option value="shipped">Shipped</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
                <option value="refunded">Refunded</option>
              </select>
            </div>
            <div className="filter-stats">
              <span className="total-orders">Total: {pagination?.total || 0} orders</span>
            </div>
          </div>
        </div>

        {/* Orders Table */}
        <div className="admin-section">
          <div className="orders-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Customer</th>
                  <th>Date</th>
                  <th>Items</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Payment</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="no-data">
                      No orders found
                    </td>
                  </tr>
                ) : (
                  orders.map((order) => (
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
                        <span className="item-count">{order.itemCount || order.items.length} items</span>
                      </td>
                      <td>
                        <span className="order-amount">₹{order.total.toFixed(2)}</span>
                      </td>
                      <td>
                        <select
                          value={order.status}
                          onChange={(e) => {
                            handleStatusChange(order._id, e.target.value);
                          }}
                          className="status-select"
                        >
                          <option value="pending">Pending (0%)</option>
                          <option value="confirmed">Order Confirmed (25%)</option>
                          <option value="processing">Processing (50%)</option>
                          <option value="shipped">Shipped (50%)</option>
                          <option value="out_for_delivery">Out for Delivery (75%)</option>
                          <option value="delivered">Delivered (100%)</option>
                          <option value="cancelled">Cancelled</option>
                          <option value="refunded">Refunded</option>
                        </select>
                      </td>
                      <td>
                        <span className="payment-method">
                          {order.payment?.method || 'N/A'}
                        </span>
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button
                            onClick={() => handleViewDetails(order._id)}
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

          {/* Pagination */}
          {pagination && pagination.pages > 1 && (
            <div className="pagination">
              <button
                className="btn-pagination"
                disabled={!pagination.hasPrevPage}
                onClick={() => setSearchParams({ 
                  page: (currentPage - 1).toString(),
                  ...(statusFilter ? { status: statusFilter } : {})
                })}
              >
                ← Previous
              </button>
              <span className="page-info">
                Page {pagination.page} of {pagination.pages}
              </span>
              <button
                className="btn-pagination"
                disabled={!pagination.hasNextPage}
                onClick={() => setSearchParams({ 
                  page: (currentPage + 1).toString(),
                  ...(statusFilter ? { status: statusFilter } : {})
                })}
              >
                Next →
              </button>
            </div>
          )}
        </div>

        {/* Order Details Modal */}
        {selectedOrder && (
          <div className="modal-overlay" onClick={closeModal}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Order Details</h2>
                <button className="modal-close" onClick={closeModal}>✕</button>
              </div>
              <div className="modal-body">
                <div className="order-detail-section">
                  <h3>Order Information</h3>
                  <div className="detail-grid">
                    <div className="detail-item">
                      <span className="detail-label">Order ID:</span>
                      <span className="detail-value">#{selectedOrder._id}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Status:</span>
                      <span className={`status-badge status-${selectedOrder.status}`}>
                        {selectedOrder.status}
                      </span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Date:</span>
                      <span className="detail-value">
                        {new Date(selectedOrder.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Total:</span>
                      <span className="detail-value">₹{selectedOrder.total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div className="order-detail-section">
                  <h3>Customer Information</h3>
                  <div className="detail-grid">
                    <div className="detail-item">
                      <span className="detail-label">Name:</span>
                      <span className="detail-value">{selectedOrder.user?.name}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Email:</span>
                      <span className="detail-value">{selectedOrder.user?.email}</span>
                    </div>
                  </div>
                </div>

                <div className="order-detail-section">
                  <h3>Shipping Address</h3>
                  <div className="address-details">
                    <p><strong>{selectedOrder.shippingAddress.fullName}</strong></p>
                    <p>{selectedOrder.shippingAddress.address}</p>
                    <p>
                      {selectedOrder.shippingAddress.city}, {selectedOrder.shippingAddress.state} - {selectedOrder.shippingAddress.pincode}
                    </p>
                    <p>Phone: {selectedOrder.shippingAddress.phone}</p>
                  </div>
                </div>

                <div className="order-detail-section">
                  <h3>Order Items</h3>
                  <div className="order-items-list">
                    {selectedOrder.items?.map((item, index) => (
                      <div key={index} className="order-item-detail">
                        <div className="item-info">
                          <span className="item-name">{item.name}</span>
                          <span className="item-qty">Qty: {item.quantity}</span>
                        </div>
                        <span className="item-price">₹{(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="order-totals">
                    <div className="total-row">
                      <span>Subtotal:</span>
                      <span>₹{selectedOrder.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="total-row">
                      <span>Tax (18% GST):</span>
                      <span>₹{selectedOrder.tax.toFixed(2)}</span>
                    </div>
                    <div className="total-row">
                      <span>Shipping:</span>
                      <span>{selectedOrder.shippingCost === 0 ? 'FREE' : `₹${selectedOrder.shippingCost.toFixed(2)}`}</span>
                    </div>
                    <div className="total-row grand-total">
                      <span>Total:</span>
                      <span>₹{selectedOrder.total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {selectedOrder.payment?.method && (
                  <div className="order-detail-section">
                    <h3>Payment Information</h3>
                    <div className="detail-grid">
                      <div className="detail-item">
                        <span className="detail-label">Method:</span>
                        <span className="detail-value">{selectedOrder.payment.method.toUpperCase()}</span>
                      </div>
                      {selectedOrder.payment.razorpayPaymentId && (
                        <div className="detail-item">
                          <span className="detail-label">Payment ID:</span>
                          <span className="detail-value">{selectedOrder.payment.razorpayPaymentId}</span>
                        </div>
                      )}
                      {selectedOrder.payment.paidAt && (
                        <div className="detail-item">
                          <span className="detail-label">Paid At:</span>
                          <span className="detail-value">
                            {new Date(selectedOrder.payment.paidAt).toLocaleString()}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {selectedOrder.statusHistory && selectedOrder.statusHistory.length > 0 && (
                  <div className="order-detail-section">
                    <h3>Status History</h3>
                    <div className="status-history">
                      {selectedOrder.statusHistory.map((history, index) => (
                        <div key={index} className="history-item">
                          <span className={`status-badge status-${history.status}`}>
                            {history.status}
                          </span>
                          <span className="history-date">
                            {new Date(history.changedAt).toLocaleString()}
                          </span>
                          {history.note && <span className="history-note">{history.note}</span>}
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