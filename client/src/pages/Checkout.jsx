import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../services/api';

// Generate proper UUID v4 using Web Crypto API
const generateUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older browsers
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

const CITIES_BY_STATE = {
  'Andhra Pradesh': ['Visakhapatnam', 'Vijayawada', 'Guntur', 'Nellore', 'Kurnool', 'Rajahmundry', 'Tirupati', 'Kakinada', 'Anantapur', 'Eluru'],
  'Arunachal Pradesh': ['Itanagar', 'Naharlagun', 'Pasighat', 'Tawang', 'Bomdila', 'Ziro'],
  'Assam': ['Guwahati', 'Silchar', 'Dibrugarh', 'Jorhat', 'Nagaon', 'Tinsukia', 'Tezpur', 'Bongaigaon'],
  'Bihar': ['Patna', 'Gaya', 'Bhagalpur', 'Muzaffarpur', 'Purnia', 'Darbhanga', 'Bihar Sharif', 'Arrah', 'Begusarai', 'Katihar'],
  'Chhattisgarh': ['Raipur', 'Bhilai', 'Bilaspur', 'Korba', 'Durg', 'Rajnandgaon', 'Raigarh', 'Jagdalpur'],
  'Goa': ['Panaji', 'Margao', 'Vasco da Gama', 'Mapusa', 'Ponda', 'Bicholim'],
  'Gujarat': ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Bhavnagar', 'Jamnagar', 'Junagadh', 'Gandhinagar', 'Anand', 'Navsari'],
  'Haryana': ['Chandigarh', 'Faridabad', 'Gurugram', 'Panipat', 'Ambala', 'Yamunanagar', 'Rohtak', 'Hisar', 'Karnal', 'Sonipat'],
  'Himachal Pradesh': ['Shimla', 'Dharamshala', 'Manali', 'Solan', 'Mandi', 'Kullu', 'Hamirpur', 'Bilaspur'],
  'Jharkhand': ['Ranchi', 'Jamshedpur', 'Dhanbad', 'Bokaro', 'Deoghar', 'Hazaribagh', 'Giridih', 'Phusro'],
  'Karnataka': ['Bangalore', 'Mysore', 'Hubli', 'Mangalore', 'Belgaum', 'Davangere', 'Bellary', 'Gulbarga', 'Shimoga', 'Tumkur'],
  'Kerala': ['Thiruvananthapuram', 'Kochi', 'Kozhikode', 'Thrissur', 'Alappuzha', 'Kollam', 'Palakkad', 'Kannur', 'Kottayam', 'Malappuram'],
  'Madhya Pradesh': ['Indore', 'Bhopal', 'Jabalpur', 'Ujjain', 'Gwalior', 'Sagar', 'Dewas', 'Satna', 'Ratlam', 'Burhanpur'],
  'Maharashtra': ['Mumbai', 'Pune', 'Nagpur', 'Thane', 'Aurangabad', 'Nashik', 'Solapur', 'Kolhapur', 'Amravati', 'Navi Mumbai'],
  'Manipur': ['Imphal', 'Thoubal', 'Bishnupur', 'Churachandpur', 'Senapati'],
  'Meghalaya': ['Shillong', 'Tura', 'Nongstoin', 'Jowai', 'Baghmara'],
  'Mizoram': ['Aizawl', 'Lunglei', 'Champhai', 'Serchhip', 'Kolasib'],
  'Nagaland': ['Kohima', 'Dimapur', 'Mokokchung', 'Tuensang', 'Wokha', 'Zunheboto'],
  'Odisha': ['Bhubaneswar', 'Cuttack', 'Rourkela', 'Brahmapur', 'Sambalpur', 'Puri', 'Balasore', 'Bhadrak', 'Baripada'],
  'Punjab': ['Ludhiana', 'Amritsar', 'Jalandhar', 'Patiala', 'Bathinda', 'Mohali', 'Hoshiarpur', 'Batala', 'Pathankot', 'Moga'],
  'Rajasthan': ['Jaipur', 'Jodhpur', 'Udaipur', 'Kota', 'Bikaner', 'Ajmer', 'Bhilwara', 'Alwar', 'Sikar', 'Pali'],
  'Sikkim': ['Gangtok', 'Namchi', 'Mangan', 'Gyalshing', 'Rangpo'],
  'Tamil Nadu': ['Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem', 'Tirunelveli', 'Vellore', 'Erode', 'Thoothukudi', 'Dindigul'],
  'Telangana': ['Hyderabad', 'Warangal', 'Nizamabad', 'Karimnagar', 'Khammam', 'Ramagundam', 'Mahbubnagar', 'Nalgonda', 'Adilabad'],
  'Tripura': ['Agartala', 'Udaipur', 'Dharmanagar', 'Kailashahar', 'Belonia'],
  'Uttar Pradesh': ['Lucknow', 'Kanpur', 'Agra', 'Varanasi', 'Meerut', 'Allahabad', 'Bareilly', 'Aligarh', 'Moradabad', 'Ghaziabad'],
  'Uttarakhand': ['Dehradun', 'Haridwar', 'Rishikesh', 'Haldwani', 'Roorkee', 'Rudrapur', 'Kashipur', 'Nainital'],
  'West Bengal': ['Kolkata', 'Howrah', 'Durgapur', 'Asansol', 'Siliguri', 'Bardhaman', 'Malda', 'Baharampur', 'Habra', 'Kharagpur'],
  'Delhi': ['New Delhi', 'Dwarka', 'Rohini', 'Saket', 'Connaught Place', 'Karol Bagh', 'Lajpat Nagar', 'Pitampura', 'Janakpuri', 'Vasant Kunj'],
  'Jammu and Kashmir': ['Srinagar', 'Jammu', 'Anantnag', 'Baramulla', 'Kathua', 'Sopore', 'Udhampur', 'Pulwama']
};

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
    country: 'India',
  });
  const [selectedPayment, setSelectedPayment] = useState('razorpay');
  const [paymentMode, setPaymentMode] = useState('online');
  const [cart, setCart] = useState(null);
  const [fetchingCart, setFetchingCart] = useState(true);
  const [orderId, setOrderId] = useState(null);
  const [addressCompleted, setAddressCompleted] = useState(false);

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
    const { name, value } = e.target;
    setFormData(prev => {
      const updated = { ...prev, [name]: value };
      if (name === 'state') {
        updated.city = '';
      }
      return updated;
    });
  };

  useEffect(() => {
    const isComplete = formData.fullName && formData.phone && formData.address && 
                      formData.city && formData.state && formData.pincode;
    setAddressCompleted(isComplete);
  }, [formData]);

  const handleProceedToPayment = (e) => {
    e.preventDefault();
    setError('');
    if (!formData.fullName || !formData.phone || !formData.address || !formData.city || !formData.state || !formData.pincode) {
      setError('Please fill in all shipping address fields');
      return;
    }
    document.getElementById('payment-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleRazorpayPayment = async (shippingAddress) => {
    try {
      // Step 1: Create Razorpay order from cart (NO DB order yet)
      console.log('🔵 Creating Razorpay order from cart...');
      const payRes = await api.post('/payments/create', { shippingAddress });
      const { razorpayOrderId, amount, currency, keyId } = payRes.data;
      console.log('✅ Razorpay order created:', { razorpayOrderId, amount, currency });

      // Step 2: Open Razorpay checkout modal
      const options = {
        key: keyId,
        amount: amount,
        currency: currency,
        name: 'ShopEase',
        description: `Order #${razorpayOrderId.slice(-8)}`,
        order_id: razorpayOrderId,
        handler: async function (response) {
          console.log('✅ Razorpay payment success:', response);
          try {
            setError('');
            // Step 3: Verify payment + CREATE ORDER in DB (only if payment verified)
            const verifyRes = await api.post('/payments/verify', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              shippingAddress,  // send shipping details so backend can create order
            });
            console.log('✅ Payment verified & order created:', verifyRes.data);
            const newOrderId = verifyRes.data.order?._id || verifyRes.data.orderId;
            if (newOrderId) {
              setOrderId(newOrderId);
              if (onCartUpdate) {
                onCartUpdate({ items: [], totalAmount: 0, totalItems: 0 });
              }
              handleOrderSuccess(newOrderId);
            }
          } catch (verifyErr) {
            console.error('❌ Payment verification failed:', verifyErr);
            setError(verifyErr.response?.data?.message || 'Payment verification failed. Please contact support.');
            setLoading(false);
          }
        },
        modal: {
          ondismiss: function() {
            console.log('❌ Razorpay modal closed — no order created');
            setError('Payment cancelled. No order was placed. You can try again.');
            setLoading(false);
          },
        },
        prefill: {
          name: formData.fullName,
          email: '',
          contact: formData.phone,
        },
        theme: {
          color: '#3399cc',
        },
      };

      // Show only Netbanking, hide Cards and Wallet
      options.method = { netbanking: true, card: false, wallet: false };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      console.error('❌ Failed to create Razorpay order:', err);
      console.error('❌ Error response:', err.response?.data);
      setError(err.response?.data?.message || 'Failed to initiate payment. Please try again.');
      setLoading(false);
    }
  };

  const handlePlaceOrder = async () => {
    if (!selectedPayment) {
      setError('Please select a payment method');
      return;
    }

    if (!addressCompleted) {
      setError('Please complete all address fields before placing order');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const formattedPhone = formData.phone.replace(/[\s+()-]/g, '');
      const shippingAddress = {
        address: formData.address,
        city: formData.city,
        state: formData.state,
        zipCode: formData.pincode,
        country: formData.country,
        phone: formattedPhone,
      };

      if (selectedPayment === 'cod') {
        // COD: Create order directly
        const idempotencyKey = generateUUID();
        console.log('🔵 Creating COD order with payload:', { shippingAddress, paymentMethod: 'cod' });
        const orderRes = await api.post('/orders', { 
          shippingAddress,
          paymentMethod: 'cod',
        }, {
          headers: { 'Idempotency-Key': idempotencyKey }
        });

        const order = orderRes.data;
        if (order._id) {
          setOrderId(order._id);
          handleOrderSuccess(order._id);
        } else {
          setError('Order creation failed. Please try again.');
          setLoading(false);
        }
      } else if (selectedPayment === 'razorpay') {
        // Netbanking via Razorpay
        console.log('🔵 Opening Razorpay Netbanking modal directly from cart (no DB order yet)');
        await handleRazorpayPayment(shippingAddress);
      }

      if (onCartUpdate) {
        onCartUpdate({ items: [], totalAmount: 0, totalItems: 0 });
      }
    } catch (err) {
      console.error('❌ Order processing failed:', err);
      console.error('❌ Error response:', err.response?.data);
      setError(err.response?.data?.message || 'Failed to process order. Please try again.');
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
  const availableCities = CITIES_BY_STATE[formData.state] || [];

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
                    <select
                      id="city"
                      name="city"
                      value={formData.city}
                      onChange={handleChange}
                      required
                      disabled={!formData.state}
                    >
                      <option value="">
                        {formData.state ? 'Select City' : 'Select State First'}
                      </option>
                      {availableCities.map(city => (
                        <option key={city} value={city}>{city}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <button type="submit" className="btn-submit">
                  Proceed to Payment
                </button>
              </form>
            </div>

            {addressCompleted && (
              <div id="payment-section" className="section-card payment-section">
                <h2 className="section-title">
                  <span className="title-icon">🏦</span>
                  Netbanking Payment
                </h2>

                <p style={{ fontSize: '0.95rem', color: '#4b5563', marginBottom: '1rem', textAlign: 'center' }}>
                  Pay securely using your bank account via Razorpay
                </p>

                {/* Netbanking Option */}
                <div className="payment-section-group" style={{ marginBottom: '0.75rem' }}>
                  <div
                    className={`payment-method-card ${selectedPayment === 'razorpay' ? 'selected' : ''}`}
                    onClick={() => { setSelectedPayment('razorpay'); setPaymentMode('online'); setError(''); }}
                    style={{ border: selectedPayment === 'razorpay' ? '2px solid #6366f1' : '2px solid #e5e7eb', background: selectedPayment === 'razorpay' ? '#eef2ff' : '#fff', padding: '1.2rem', cursor: 'pointer', borderRadius: '12px', transition: 'all 0.2s' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{ fontSize: '2rem' }}>🏦</div>
                      <div style={{ flex: 1 }}>
                        <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#1f2937' }}>Netbanking</h3>
                        <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: '#6b7280' }}>Pay securely using your bank account</p>
                      </div>
                      <div style={{ fontSize: '1.5rem', color: selectedPayment === 'razorpay' ? '#6366f1' : '#d1d5db' }}>›</div>
                    </div>
                  </div>
                  <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem', color: '#6b7280', textAlign: 'center' }}>
                    💡 Secure payment via Razorpay - All major banks supported
                  </p>
                </div>

                {/* COD Option */}
                <div className="payment-section-group" style={{ marginBottom: '0.25rem' }}>
                  <div
                    className={`payment-method-card ${selectedPayment === 'cod' ? 'selected' : ''}`}
                    onClick={() => { setSelectedPayment('cod'); setPaymentMode('cod'); setError(''); }}
                    style={{ border: selectedPayment === 'cod' ? '2px solid #6366f1' : '1px solid #e5e7eb', background: selectedPayment === 'cod' ? '#f9fafb' : '#fff', padding: '0.85rem 1rem', cursor: 'pointer', borderRadius: '10px', transition: 'all 0.2s' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ fontSize: '1.3rem' }}>💵</div>
                      <div style={{ flex: 1 }}>
                        <h3 style={{ margin: 0, fontSize: '1rem', color: '#374151' }}>Cash on Delivery</h3>
                        <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.8rem', color: '#9ca3af' }}>Pay when you receive your order</p>
                      </div>
                      <div style={{ fontSize: '1.2rem', color: selectedPayment === 'cod' ? '#6366f1' : '#d1d5db' }}>›</div>
                    </div>
                  </div>
                </div>

                <button 
                  onClick={handlePlaceOrder}
                  className="btn-submit btn-place-order"
                  disabled={loading || !selectedPayment}
                  style={{ marginTop: '1rem', padding: '0.9rem 2rem', fontSize: '1.1rem', fontWeight: 600 }}
                >
                  {loading ? (
                    <>
                      <span className="spinner"></span>
                      Processing...
                    </>
                  ) : paymentMode === 'online' ? (
                    `Pay ₹${total.toFixed(2)}`
                  ) : paymentMode === 'cod' ? (
                    'Place Order (COD)'
                  ) : (
                    `Pay ₹${total.toFixed(2)}`
                  )}
                </button>
              </div>
            )}
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