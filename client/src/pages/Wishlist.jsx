import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';

export default function Wishlist() {
  const [wishlist, setWishlist] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWishlist();
  }, []);

  const fetchWishlist = async () => {
    try {
      const res = await api.get('/wishlist');
      setWishlist(res.data.wishlist);
    } catch (err) {
      console.error('Error fetching wishlist:', err);
    } finally {
      setLoading(false);
    }
  };

  const removeFromWishlist = async (productId) => {
    try {
      await api.delete(`/wishlist/remove/${productId}`);
      fetchWishlist();
    } catch (err) {
      console.error('Error removing from wishlist:', err);
    }
  };

  const addToCart = async (productId) => {
    try {
      await api.post('/cart/add', { productId, quantity: 1 });
      alert('Added to cart!');
    } catch (err) {
      console.error('Error adding to cart:', err);
    }
  };

  if (loading) {
    return (
      <div className="wishlist-page">
        <div className="container">
          <div className="loading-spinner"></div>
          <p className="loading-text">Loading...</p>
        </div>
      </div>
    );
  }

  const items = wishlist?.items || [];

  return (
    <div className="wishlist-page">
      <div className="container">
        <h1 className="page-title">❤️ My Wishlist</h1>

        {items.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">💝</div>
            <h2>Your wishlist is empty</h2>
            <p>Save products you love to your wishlist!</p>
            <Link to="/products" className="btn-primary">
              Browse Products
            </Link>
          </div>
        ) : (
          <div className="wishlist-grid">
            {items.map((item) => (
              <div key={item.product?._id || item._id} className="wishlist-card">
                <div className="wishlist-image">
                  {item.product?.images?.[0] ? (
                    <img src={item.product.images[0]} alt={item.product.name} />
                  ) : (
                    <div className="image-placeholder">📷</div>
                  )}
                </div>
                <div className="wishlist-info">
                  <h3>{item.product?.name || 'Product'}</h3>
                  <p className="wishlist-price">₹{item.product?.price?.toFixed(2) || '0.00'}</p>
                  <p className={`wishlist-stock ${item.product?.stock > 0 ? 'in-stock' : 'out-of-stock'}`}>
                    {item.product?.stock > 0 ? '✓ In Stock' : '✗ Out of Stock'}
                  </p>
                </div>
                <div className="wishlist-actions">
                  <button
                    onClick={() => addToCart(item.product?._id)}
                    className="btn-add-cart"
                    disabled={!item.product?.stock}
                  >
                    🛒 Add to Cart
                  </button>
                  <button
                    onClick={() => removeFromWishlist(item.product?._id)}
                    className="btn-remove"
                  >
                    ❌ Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}