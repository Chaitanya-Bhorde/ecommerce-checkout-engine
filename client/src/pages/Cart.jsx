import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';

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
    <p style={{ textAlign: 'center', padding: '4rem', color: '#6b7280', fontSize: '0.95rem' }}>
      Loading cart...
    </p>
  );

  const items = cart?.items || [];

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem 1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1>Shopping Cart</h1>
        {items.length > 0 && (
          <button onClick={clearCart} style={{ padding: '0.4rem 1rem', background: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '6px', cursor: 'pointer' }}>
            Clear Cart
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '4rem 1rem',
          background: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #e5e7eb',
        }}>
          <p style={{ fontSize: '1.05rem', marginBottom: '0.5rem', color: '#374151', fontWeight: '500' }}>
            Your cart is empty
          </p>
          <p style={{ fontSize: '0.9rem', color: '#6b7280', marginBottom: '1.5rem' }}>
            Looks like you haven't added anything yet.
          </p>
          <Link to="/products" style={{
            padding: '0.65rem 1.2rem',
            background: '#4f46e5',
            color: '#ffffff',
            borderRadius: '8px',
            textDecoration: 'none',
            fontSize: '0.9rem',
            fontWeight: '600',
          }}>
            Continue Shopping
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {items.map((item) => {
            const product = item.product;
            const image = product.images && product.images.length > 0 ? product.images[0] : 'https://via.placeholder.com/100x100?text=No+Image';
            const subtotal = item.quantity * product.price;
            return (
              <div key={item._id} style={{
                display: 'flex',
                gap: '1.1rem',
                border: '1px solid #e5e7eb',
                borderRadius: '12px',
                padding: '1.1rem',
                alignItems: 'center',
                background: '#ffffff',
                boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
              }}>
                <img src={image} alt={product.name} style={{ width: '88px', height: '88px', objectFit: 'cover', borderRadius: '10px' }} />
                <div style={{ flex: 1 }}>
                  <Link to={`/products/${product._id}`} style={{ color: '#111827', textDecoration: 'none', fontWeight: '600', fontSize: '0.95rem' }}>{product.name}</Link>
                  <p style={{ fontSize: '0.85rem', color: '#6b7280', marginTop: '0.2rem' }}>{product.category?.name}</p>
                  <p style={{ fontWeight: '600', marginTop: '0.25rem', color: '#111827' }}>₹{product.price.toLocaleString()}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <button onClick={() => updateQuantity(item._id, item.quantity - 1)} disabled={updating[item._id] || item.quantity <= 1} style={{ width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, border: '1px solid #d1d5db', borderRadius: '8px', background: '#ffffff', color: '#374151', fontSize: '1rem', fontWeight: '600' }}>-</button>
                  <span style={{ minWidth: '26px', textAlign: 'center', fontWeight: '600' }}>{item.quantity}</span>
                  <button onClick={() => updateQuantity(item._id, item.quantity + 1)} disabled={updating[item._id] || item.quantity >= product.stock} style={{ width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, border: '1px solid #d1d5db', borderRadius: '8px', background: '#ffffff', color: '#374151', fontSize: '1rem', fontWeight: '600' }}>+</button>
                </div>
                <div style={{ minWidth: '110px', textAlign: 'right' }}>
                  <p style={{ fontWeight: '700', color: '#111827' }}>₹{subtotal.toLocaleString()}</p>
                </div>
                <button onClick={() => removeItem(item._id)} style={{ padding: '0.45rem 0.9rem', background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: '8px', fontSize: '0.85rem', fontWeight: '500', cursor: 'pointer' }}>Remove</button>
              </div>
            );
          })}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem', padding: '1.25rem', background: '#ffffff', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
            <div style={{ textAlign: 'right', minWidth: '200px' }}>
              <p style={{ fontSize: '0.9rem', color: '#6b7280', marginBottom: '0.25rem' }}>Total Items: {cart.totalItems}</p>
              <p style={{ fontSize: '1.6rem', fontWeight: '700', color: '#111827' }}>₹{cart.totalAmount.toLocaleString()}</p>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
            <Link to="/products" style={{ padding: '0.55rem 1rem', background: '#ffffff', color: '#374151', border: '1px solid #d1d5db', borderRadius: '8px', textDecoration: 'none', fontSize: '0.9rem', fontWeight: '500' }}>Continue Shopping</Link>
            <Link to="/checkout" style={{ padding: '0.65rem 1.2rem', background: '#4f46e5', color: '#ffffff', border: 'none', borderRadius: '8px', textDecoration: 'none', fontSize: '0.9rem', fontWeight: '600' }}>Proceed to Checkout</Link>
          </div>
        </div>
      )}
    </div>
  );
}
