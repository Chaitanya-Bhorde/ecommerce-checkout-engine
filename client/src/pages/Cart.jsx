import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { FALLBACK_IMAGE } from '../components/ProductCard';
import './Cart.css';

export default function Cart() {
  const [cart, setCart] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState({});

  const fetchCart = async () => {
    setLoading(true);
    try {
      const res = await api.get('/cart');
      setCart(res.data);
    } catch (err) {
      console.error('Failed to fetch cart', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCart(); }, []);

  const updateQuantity = async (itemId, quantity) => {
    setUpdating((p) => ({ ...p, [itemId]: true }));
    try {
      const res = await api.put(`/cart/${itemId}`, { quantity });
      setCart(res.data);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update quantity');
    } finally {
      setUpdating((p) => ({ ...p, [itemId]: false }));
    }
  };

  const removeItem = async (itemId) => {
    if (!confirm('Remove this item from cart?')) return;
    try {
      const res = await api.delete(`/cart/${itemId}`);
      setCart(res.data);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to remove item');
    }
  };

  const clearCart = async () => {
    if (!confirm('Clear entire cart?')) return;
    try {
      const res = await api.delete('/cart');
      setCart(res.data.cart);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to clear cart');
    }
  };

  if (loading) return (
    <p className="cart-loading">
      Loading cart...
    </p>
  );

  const items = cart?.items || [];

  return (
    <div className="cart-page">
      <div className="cart-header">
        <h1>Shopping Cart</h1>
        {items.length > 0 && (
          <button onClick={clearCart} className="btn-clear-cart">
            Clear Cart
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="cart-empty">
          <p className="cart-empty-title">
            Your cart is empty
          </p>
          <p className="cart-empty-sub">
            Looks like you haven't added anything yet.
          </p>
          <Link to="/products" className="btn-continue">
            Continue Shopping
          </Link>
        </div>
      ) : (
        <div className="cart-items">
          {items.map((item) => {
            const product = item.product;
            if (!product) return null;
            const image = product.images && product.images.length > 0 ? product.images[0] : FALLBACK_IMAGE;
            const subtotal = item.quantity * product.price;
            return (
              <div key={item._id} className="cart-item">
                <img src={image} alt={product.name} className="cart-item-image" loading="lazy" onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = FALLBACK_IMAGE; }} />
                <div className="cart-item-details">
                  <Link to={`/products/${product._id}`} className="cart-item-name">{product.name}</Link>
                  <p className="cart-item-category">{product.category?.name}</p>
                  <p className="cart-item-price">₹{product.price.toLocaleString()}</p>
                </div>
                <div className="cart-item-quantity">
                  <button onClick={() => updateQuantity(item._id, item.quantity - 1)} disabled={updating[item._id] || item.quantity <= 1} className="qty-btn">-</button>
                  <span className="qty-value">{item.quantity}</span>
                  <button onClick={() => updateQuantity(item._id, item.quantity + 1)} disabled={updating[item._id] || item.quantity >= product.stock} className="qty-btn">+</button>
                </div>
                <div className="cart-item-subtotal">
                  <p className="cart-item-subtotal-value">₹{subtotal.toLocaleString()}</p>
                </div>
                <button onClick={() => removeItem(item._id)} className="btn-remove">Remove</button>
              </div>
            );
          })}

          <div className="cart-total">
            <div className="cart-total-inner">
              <p className="cart-total-count">Total Items: {cart.totalItems}</p>
              <p className="cart-total-amount">₹{cart.totalAmount.toLocaleString()}</p>
            </div>
          </div>

          <div className="cart-actions">
            <Link to="/products" className="btn-continue-shopping">Continue Shopping</Link>
            <Link to="/checkout" className="btn-checkout">Proceed to Checkout</Link>
          </div>
        </div>
      )}
    </div>
  );
}
