import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../services/api';

// Simple UUID v4 generator
const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
  'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Delhi', 'Jammu and Kashmir'
];

const MAJOR_CITIES = [
  'Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Kolkata', 'Hyderabad',
  'Pune', 'Ahmedabad', 'Jaipur', 'Lucknow', 'Kanpur', 'Nagpur',
  'Indore', 'Thane', 'Bhopal', 'Visakhapatnam', 'Patna', 'Vadodara'
];

const PAYMENT_METHODS = [
  { id: 'razorpay', label: 'Credit/Debit Card / UPI', icon: '💳', description: 'Pay securely with Razorpay' },
  { id: 'cod', label: 'Cash on Delivery', icon: '💵', description: 'Pay when you receive' },
];

export default function Checkout({ onCartUpdate }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
  });
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [cart, setCart] = useState(null);
  const [fetchingCart, setFetchingCart] = useState(true);
  const [orderId, setOrderId] = useState(null);

  useEffect(() => {
    const fetchCart = async () => {
      try {
        const res = await api.get('/cart');
        setCart(res.data);
      } catch (err) {
        console.error('Failed to fetch cart', err);
      } finally {
        setFetchingCart(false);
      }
    };
    fetchCart();
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleProceedToPayment = (e) => {
    e.preventDefault();
    setError('');
    if (!formData.fullName || !formData.phone || !formData.address || !formData.city || !formData.state || !formData.pincode) {
      setError('Please fill in all shipping address fields');
      return;
    }
    document.getElementById('payment-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handlePlaceOrder = async () => {
    if (!selectedPayment) {
      setError('Please select a payment method');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const idempotencyKey = generateUUID();
      const orderRes = await api.post('/orders', { 
        shippingAddress: formData,
        paymentMethod: selectedPayment 
      }, {
        headers: {
          'Idempotency-Key': idempotencyKey
        }
      });
      const order = orderRes.data;
      setOrderId(order._id);

      if (selectedPayment === 'razorpay') {
        const paymentRes = await api.post(`/payments/create/${order._id}`);
        const paymentData = paymentRes.data;

        const options = {
          key: paymentData.keyId,
          amount: paymentData.amount,
          currency: paymentData.currency,
          name: 'ShopEase',
          description: `Order #${order._id.slice(-8)}`,
          order_id: paymentData.razorpayOrderId,
          handler: async function (response) {
            try {
              await api.post('/payments/verify', {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              });
              handleOrderSuccess(order._id);
            } catch (err) {
              setError('Payment verification failed. Please contact support.');
              setLoading(false);
            }
          },
          prefill: {
            name: formData.fullName,
            contact: formData.phone,
          },
          theme: {
            color: '#4f46e5',
          },
        };

        const razorpay = new window.Razorpay(options);
        razorpay.open();
      } else {
        handleOrderSuccess(order._id);
      }

      if (onCartUpdate) {
        onCartUpdate({ items: [], totalAmount: 0, totalItems: 0 });
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create order. Please try again.');
      setLoading(false);
    }
  };

  const handleOrderSuccess = (orderId) => {
    setSuccess(true);
    setTimeout(() => {
      navigate(`/order-confirmation/${orderId}`);
    }, 2000);
  };

  if (fetchingCart) {
    return (
      <div className="checkout-page">
        <div className="container">
          <div className="loading-spinner"></div>
          <p className="loading-text">Loading your cart...</p>
        </div>
      </div>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="checkout-page">
        <div className="container">
          <div className="empty-state">
            <div className="empty-icon">🛒</div>
            <h2>Your cart is empty</h2>
            <p>Add some products before checkout.</p>
            <Link to="/products" className="btn-primary">
              Continue Shopping
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const subtotal = cart.totalAmount;
  const tax = subtotal * 0.18;
  const shipping = subtotal >= 500 ? 0 : 40;
  const total = subtotal + tax + shipping;

  if (success) {
    return (
      <div className="checkout-page">
        <div className="container">
          <div className="success-state">
            <div className="success-icon-large">✓</div>
            <h2>Order Placed Successfully!</h2>
            <p className="order-id">Order ID: {orderId}</p>
            <p>Redirecting to order confirmation...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="checkout-page">
      <div className="container">
        <h1 className="page-title">Checkout</h1>

        {error && <div className="alert alert-error">{error}</div>}

        <div className="checkout-grid">
          <div className="shipping-section">
            <div className="section-card">
              <h2 className="section-title">
                <span className="title-icon">📍</span>
                Shipping Address
              </h2>
              <form onSubmit={handleProceedToPayment} className="shipping-form">
                <div className="form-row">
                  <div className="form-group full-width">
                    <label htmlFor="fullName">Full Name *</label>
                    <input
                      type="text"
                      id="fullName"
                      name="fullName"
                      value={formData.fullName}
                      onChange={handleChange}
                      required
                      placeholder="Enter your full name"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="phone">Phone Number *</label>
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      required
                      placeholder="+91 9876543210"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="pincode">Pincode *</label>
                    <input
                      type="text"
                      id="pincode"
                      name="pincode"
                      value={formData.pincode}
                      onChange={handleChange}
                      required
                      placeholder="400001"
                      pattern="[0-9]{6}"
                      maxLength="6"
                    />
                  </div>
                </div>

                <div className="form-group full-width">
                  <label htmlFor="address">Address *</label>
                  <textarea
                    id="address"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    required
                    rows="3"
                    placeholder="Street address, apartment, suite, etc."
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="state">State *</label>
                    <select
                      id="state"
                      name="state"
                      value={formData.state}
                      onChange={handleChange}
                      required
                    >
                      <option value="">Select State</option>
                      {INDIAN_STATES.map(state => (
                        <option key={state} value={state}>{state}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="city">City *</label>
                    <input
                      type="text"
                      id="city"
                      name="city"
                      value={formData.city}
                      onChange={handleChange}
                      required
                      placeholder="Enter your city"
                      list="cities"
                    />
                    <datalist id="cities">
                      {MAJOR_CITIES.map(city => (
                        <option key={city} value={city} />
                      ))}
                    </datalist>
                  </div>
                </div>

                <button 
                  type="submit" 
                  className="btn-submit"
                >
                  Proceed to Payment
                </button>
              </form>
            </div>

            <div id="payment-section" className="section-card payment-section">
              <h2 className="section-title">
                <span className="title-icon">💳</span>
                Select Payment Method
              </h2>
              <div className="payment-methods">
                {PAYMENT_METHODS.map(method => (
                  <div
                    key={method.id}
                    className={`payment-method-card ${selectedPayment === method.id ? 'selected' : ''}`}
                    onClick={() => setSelectedPayment(method.id)}
                  >
                    <div className="payment-radio">
                      <div className="radio-circle">
                        {selectedPayment === method.id && <div className="radio-dot"></div>}
                      </div>
                    </div>
                    <div className="payment-icon">{method.icon}</div>
                    <div className="payment-info">
                      <h3>{method.label}</h3>
                      <p>{method.description}</p>
                    </div>
                  </div>
                ))}
              </div>

              <button 
                onClick={handlePlaceOrder}
                className="btn-submit btn-place-order"
                disabled={loading || !selectedPayment}
              >
                {loading ? (
                  <>
                    <span className="spinner"></span>
                    Processing...
                  </>
                ) : (
                  'Place Order'
                )}
              </button>
            </div>
          </div>

          <div className="summary-section">
            <div className="summary-card">
              <h2 className="section-title">
                <span className="title-icon">📦</span>
                Order Summary
              </h2>
              
              <div className="cart-items">
                {cart.items.map((item) => (
                  <div key={item._id || item.product} className="cart-item">
                    <div className="item-image">
                      {item.product?.images?.[0] ? (
                        <img src={item.product.images[0]} alt={item.product.name} />
                      ) : (
                        <div className="image-placeholder">📷</div>
                      )}
                    </div>
                    <div className="item-details">
                      <p className="item-name">{item.product?.name || 'Product'}</p>
                      <p className="item-meta">Qty: {item.quantity}</p>
                    </div>
                    <div className="item-price">
                      ₹{(item.price * item.quantity).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>

              <div className="price-breakdown">
                <div className="price-row">
                  <span>Subtotal</span>
                  <span>₹{subtotal.toFixed(2)}</span>
                </div>
                <div className="price-row">
                  <span>Tax (18% GST)</span>
                  <span>₹{tax.toFixed(2)}</span>
                </div>
                <div className="price-row">
                  <span>Shipping</span>
                  <span className={shipping === 0 ? 'free-shipping' : ''}>
                    {shipping === 0 ? 'FREE' : `₹${shipping.toFixed(2)}`}
                  </span>
                </div>
                <div className="price-row total">
                  <span>Total</span>
                  <span>₹{total.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}