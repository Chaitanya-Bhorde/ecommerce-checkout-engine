import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import './ProductDetail.css';
export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [product, setProduct] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [reviewStats, setReviewStats] = useState({ total: 0, averageRating: 0 });
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [isInWishlist, setIsInWishlist] = useState(false);

  useEffect(() => {
    let isCancelled = false;
    const fetchProduct = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await api.get(`/products/${id}`);
        if (!isCancelled) setProduct(res.data);
      } catch (err) {
        if (!isCancelled) setError('Product not found');
      } finally {
        if (!isCancelled) setLoading(false);
      }
    };
    fetchProduct();
    return () => { isCancelled = true; };
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const fetchReviews = async () => {
      try {
        const res = await api.get(`/reviews/${id}`);
        setReviews(res.data.reviews || []);
        setReviewStats(res.data.stats || { total: 0, averageRating: 0 });
      } catch (err) {
        console.error('Failed to fetch reviews', err);
      }
    };
    fetchReviews();
  }, [id]);

  useEffect(() => {
    if (!user || !id) return;
    const checkWishlist = async () => {
      try {
        const res = await api.get(`/wishlist/check/${id}`);
        setIsInWishlist(!!res.data?.isInWishlist);
      } catch (err) {
        console.error('Failed to check wishlist', err);
      }
    };
    checkWishlist();
  }, [user, id]);

  const handleAddToCart = async () => {
    if (!user) {
      if (window.confirm('Please login to add items to cart. Click OK to go to login page.')) {
        navigate('/login');
      }
      return;
    }
    setAdding(true);
    try {
      await api.post('/cart', { productId: id, quantity });
      alert('Added to cart!');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to add to cart');
    } finally {
      setAdding(false);
    }
  };

  const handleToggleWishlist = async () => {
    if (!user) {
      if (window.confirm('Please login to manage wishlist. Click OK to go to login page.')) {
        navigate('/login');
      }
      return;
    }
    try {
      if (isInWishlist) {
        await api.delete(`/wishlist/remove/${id}`);
        setIsInWishlist(false);
      } else {
        await api.post('/wishlist/add', { productId: id });
        setIsInWishlist(true);
      }
    } catch (err) {
      console.error('Failed to update wishlist', err);
    }
  };

  const renderStars = (rating) => {
    const full = Math.floor(rating);
    const stars = [];
    for (let i = 0; i < 5; i++) {
      stars.push(<span key={i} className={i < full ? 'star filled' : 'star'}>★</span>);
    }
    return stars;
  };

  if (loading) {
    return (
      <div className="product-detail-page">
        <div className="container">
          <div className="loading-spinner"></div>
          <p className="loading-text">Loading product...</p>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="product-detail-page">
        <div className="container">
          <div className="empty-state">
            <div className="empty-icon">🔍</div>
            <h2>{error || 'Product not found'}</h2>
            <p>The product you are looking for does not exist or has been removed.</p>
            <Link to="/products" className="btn-primary">Browse Products</Link>
          </div>
        </div>
      </div>
    );
  }

  const inStock = product.stock > 0;
  const images = product.images && product.images.length > 0
    ? product.images
    : ['https://via.placeholder.com/600x600?text=No+Image'];

  return (
    <div className="product-detail-page">
      <div className="container">
        <nav className="breadcrumb">
          <Link to="/products">Products</Link>
          <span className="breadcrumb-sep">/</span>
          <span>{product.category?.name || 'Uncategorized'}</span>
          <span className="breadcrumb-sep">/</span>
          <span className="breadcrumb-current">{product.name}</span>
        </nav>

        <div className="product-detail-grid">
          <div className="product-gallery">
            <div className="gallery-main">
              <img src={images[activeImage]} alt={product.name} />
            </div>
            {images.length > 1 && (
              <div className="gallery-thumbs">
                {images.map((img, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className={idx === activeImage ? 'thumb active' : 'thumb'}
                    onClick={() => setActiveImage(idx)}
                  >
                    <img src={img} alt={`${product.name} ${idx + 1}`} />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="product-info-panel">
            <p className="detail-category">{product.category?.name || 'Uncategorized'}</p>
            <h1 className="detail-name">{product.name}</h1>

            <div className="detail-rating">
              {renderStars(reviewStats.averageRating || product.ratings || 0)}
              <span className="rating-count">
                {reviewStats.total > 0
                  ? `${reviewStats.averageRating} (${reviewStats.total} reviews)`
                  : 'No reviews yet'}
              </span>
            </div>

            <div className="detail-price">
              <span className="price-current">₹{product.price.toLocaleString()}</span>
            </div>

            <div className={inStock ? 'detail-stock in-stock' : 'detail-stock out-of-stock'}>
              {inStock ? `✓ In Stock (${product.stock} available)` : '✗ Out of Stock'}
            </div>

            <p className="detail-description">{product.description}</p>

            {inStock && (
              <div className="detail-quantity">
                <label>Quantity</label>
                <div className="quantity-controls">
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    disabled={quantity <= 1}
                  >
                    −
                  </button>
                  <span>{quantity}</span>
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.min(product.stock, q + 1))}
                    disabled={quantity >= product.stock}
                  >
                    +
                  </button>
                </div>
              </div>
            )}

            <div className="detail-actions">
              <button
                onClick={handleAddToCart}
                className="btn-primary btn-add-to-cart"
                disabled={!inStock || adding}
              >
                {adding ? 'Adding...' : '🛒 Add to Cart'}
              </button>
              <button
                onClick={handleToggleWishlist}
                className={isInWishlist ? 'btn-wishlist active' : 'btn-wishlist'}
              >
                {isInWishlist ? '❤️ In Wishlist' : '🤍 Add to Wishlist'}
              </button>
            </div>
          </div>
        </div>

        <div className="reviews-section">
          <h2>Customer Reviews</h2>
          {reviews.length === 0 ? (
            <p className="no-reviews">This product has no reviews yet.</p>
          ) : (
            <div className="reviews-list">
              {reviews.map((review) => (
                <div key={review._id} className="review-card">
                  <div className="review-header">
                    <span className="review-author">{review.user?.name || 'Anonymous'}</span>
                    {review.isVerified && <span className="verified-badge">✓ Verified Purchase</span>}
                  </div>
                  <div className="review-stars">{renderStars(review.rating)}</div>
                  {review.title && <h4 className="review-title">{review.title}</h4>}
                  {review.comment && <p className="review-comment">{review.comment}</p>}
                  <span className="review-date">{new Date(review.createdAt).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

