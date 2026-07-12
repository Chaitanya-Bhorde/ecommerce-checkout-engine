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

const PAYMENT_METHODS = [
  { id: 'razorpay', label: 'UPI / PhonePe / GPay / Paytm', icon: '�', description: 'Pay instantly with UPI' },
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
    country: 'India', // Default country
  });
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [cart, setCart] = useState(null);
  const [fetchingCart, setFetchingCart] = useState(true);
  const [orderId, setOrderId] = useState(null);
  const [addressCompleted, setAddressCompleted] = useState(false);
  const [upiId, setUpiId] = useState('');
  const [upiError, setUpiError] = useState('');

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
      // If state changes, reset city
      if (name === 'state') {
        updated.city = '';
      }
      return updated;
    });
  };

  // Check if all address fields are filled
  useEffect(() => {
    const isComplete = formData.fullName && formData.phone && formData.address && 
                      formData.city && formData.state && formData.pincode;
    setAddressCompleted(isComplete);
  }, [formData]);

  // Validate UPI ID format
  const validateUpiId = (upi) => {
    setUpiError('');
    if (!upi || upi.trim() === '') {
      setUpiError('Please enter your UPI ID');
      return false;
    }
    // UPI ID format: username@provider (e.g., aman@paytm, 9876543210@ybl, name@gpay)
    const upiRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+$/;
    if (!upiRegex.test(upi)) {
      setUpiError('Invalid UPI ID format. Use format: yourname@paytm or 9876543210@ybl');
      return false;
    }
    return true;
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

    // Double-check address is complete
    if (!addressCompleted) {
      setError('Please complete all address fields before placing order');
      return;
    }

    // Validate UPI ID if Razorpay is selected
    if (selectedPayment === 'razorpay') {
      if (!validateUpiId(upiId)) {
        return;
      }
    }

    setError('');
    setLoading(true);

    try {
      if (selectedPayment === 'razorpay') {
        // UPI Payment Flow: Open Razorpay first, verify payment, then create order
        console.log('🔵 Initiating UPI payment...');
        
        // Create payment order
        const paymentRes = await api.post('/payments/create');
        const paymentData = paymentRes.data;

        const options = {
          key: paymentData.keyId,
          amount: paymentData.amount,
          currency: paymentData.currency,
          name: 'ShopEase',
          description: 'UPI Payment',
          order_id: paymentData.razorpayOrderId,
          method: 'upi',
          upi: { vpa: upiId },
          handler: async function (response) {
            try {
              // Verify payment first
              const verifyRes = await api.post('/payments/verify', {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              });
              
              console.log('✅ Payment verified:', verifyRes.data);
              
              // Now create the order after successful payment
              const idempotencyKey = generateUUID();
              
              const shippingAddress = {
                ...formData,
                zipCode: formData.pincode,
              };
              
              const orderRes = await api.post('/orders', { 
                shippingAddress,
                paymentMethod: selectedPayment,
                paymentId: response.razorpay_payment_id,
                orderId: response.razorpay_order_id
              }, {
                headers: {
                  'Idempotency-Key': idempotencyKey
                }
              });
              
              const order = orderRes.data;
              console.log('✅ Order created after payment:', order);
              
              if (order._id) {
                setOrderId(order._id);
                handleOrderSuccess(order._id);
              } else {
                setError('Payment successful but order creation failed. Please contact support.');
                setLoading(false);
              }
            } catch (err) {
              console.error('❌ Payment verification failed:', err);
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
        // COD: Create order directly without payment
        const idempotencyKey = generateUUID();
        
        const shippingAddress = {
          ...formData,
          zipCode: formData.pincode,
        };
        
        const orderRes = await api.post('/orders', { 
          shippingAddress,
          paymentMethod: selectedPayment 
        }, {
          headers: {
            'Idempotency-Key': idempotencyKey
          }
        });
        
        const order = orderRes.data;
        
        if (order._id) {
          setOrderId(order._id);
          handleOrderSuccess(order._id);
        } else {
          setError('Order creation failed. Please try again.');
          setLoading(false);
        }
      }

      if (onCartUpdate) {
        onCartUpdate({ items: [], totalAmount: 0, totalItems: 0 });
      }
    } catch (err) {
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

                <button 
                  type="submit" 
                  className="btn-submit"
                >
                  Proceed to Payment
                </button>
              </form>
            </div>

            {addressCompleted && (
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

                {selectedPayment === 'razorpay' && (
                  <div style={{ marginTop: '1rem', padding: '1rem', background: '#f3f4f6', borderRadius: '8px' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#374151' }}>
                      Enter Your UPI ID:
                    </label>
                    <input
                      type="text"
                      value={upiId}
                      onChange={(e) => {
                        setUpiId(e.target.value);
                        setUpiError('');
                      }}
                      placeholder="e.g., aman@paytm, 9876543210@ybl, name@gpay"
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: upiError ? '1px solid #dc2626' : '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '1rem',
                        outline: 'none'
                      }}
                    />
                    {upiError && (
                      <p style={{ color: '#dc2626', fontSize: '0.85rem', marginTop: '0.5rem', marginBottom: 0 }}>
                        ⚠️ {upiError}
                      </p>
                    )}
                    <p style={{ color: '#6b7280', fontSize: '0.8rem', marginTop: '0.5rem', marginBottom: 0 }}>
                      💡 Enter any UPI ID (e.g., aman@paytm, 9876543210@ybl)
                    </p>
                  </div>
                )}

                <button 
                  onClick={handlePlaceOrder}
                  className="btn-submit btn-place-order"
                  disabled={loading || !selectedPayment || (selectedPayment === 'razorpay' && !upiId)}
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