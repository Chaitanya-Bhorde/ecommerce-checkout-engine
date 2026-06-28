import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../services/api';

export default function OrderConfirmation() {
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const res = await api.get(`/orders/${orderId}`);
        setOrder(res.data);
      } catch (err) {
        setError('Failed to load order details');
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [orderId]);

  if (loading) {
    return (
      <div className="confirmation-page">
        <div className="container">
          <div className="loading">Loading order details...</div>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="confirmation-page">
        <div className="container">
          <div className="error-message">{error || 'Order not found'}</div>
          <Link to="/products" className="btn-primary">
            Continue Shopping
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="confirmation-page">
      <div className="container">
        <div className="confirmation-header">
          <div className="success-icon">✓</div>
          <h1>Order Confirmed!</h1>
          <p className="order-number">Order ID: {order._id}</p>
          <p className="confirmation-message">
            Thank you for your purchase. We've sent a confirmation email with your order details.
          </p>
        </div>

        <div className="confirmation-details">
          <div className="detail-section">
            <h2>Shipping Address</h2>
            <div className="address-info">
              <p><strong>{order.shippingAddress.fullName}</strong></p>
              <p>{order.shippingAddress.address}</p>
              <p>
                {order.shippingAddress.city}, {order.shippingAddress.state} - {order.shippingAddress.pincode}
              </p>
              <p>Phone: {order.shippingAddress.phone}</p>
            </div>
          </div>

          <div className="detail-section">
            <h2>Order Summary</h2>
            <div className="order-items">
              {order.items.map((item, index) => (
                <div key={index} className="order-item">
                  <div className="item-details">
                    <span className="item-name">{item.name}</span>
                    <span className="item-qty">Qty: {item.quantity}</span>
                  </div>
                  <span className="item-price">₹{(item.price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div className="order-totals">
              <div className="total-row">
                <span>Subtotal</span>
                <span>₹{order.subtotal.toFixed(2)}</span>
              </div>
              <div className="total-row">
                <span>Tax (18% GST)</span>
                <span>₹{order.tax.toFixed(2)}</span>
              </div>
              <div className="total-row">
                <span>Shipping</span>
                <span>{order.shippingCost === 0 ? 'FREE' : `₹${order.shippingCost.toFixed(2)}`}</span>
              </div>
              <div className="total-row grand-total">
                <span>Total</span>
                <span>₹{order.total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="detail-section">
            <h2>Payment Information</h2>
            <div className="payment-info">
              {order.payment && order.payment.method ? (
                <>
                  <p><strong>Payment Method:</strong> {order.payment.method.toUpperCase()}</p>
                  {order.payment.razorpayPaymentId && (
                    <p><strong>Payment ID:</strong> {order.payment.razorpayPaymentId}</p>
                  )}
                  {order.payment.paidAt && (
                    <p><strong>Paid At:</strong> {new Date(order.payment.paidAt).toLocaleString()}</p>
                  )}
                </>
              ) : (
                <p><strong>Status:</strong> <span className={`status-badge status-${order.status}`}>{order.status}</span></p>
              )}
            </div>
          </div>
        </div>

        <div className="confirmation-actions">
          <Link to="/orders" className="btn-primary">
            View All Orders
          </Link>
          <Link to="/products" className="btn-secondary">
            Continue Shopping
          </Link>
        </div>
      </div>
    </div>
  );
}