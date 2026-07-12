import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function ProductCard({ product, onAddToCart, onToggleWishlist, isInWishlist }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const image = product.images && product.images.length > 0
    ? product.images[0]
    : 'https://via.placeholder.com/400x300?text=No+Image';

  const inStock = product.stock > 0;

  return (
    <div style={{
      border: '1px solid #e5e7eb',
      borderRadius: '12px',
      overflow: 'hidden',
      background: '#ffffff',
      display: 'flex',
      flexDirection: 'column',
      transition: 'all 0.2s ease',
      boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.boxShadow = '0 10px 15px -3px rgb(0 0 0 / 0.1)';
      e.currentTarget.style.transform = 'translateY(-2px)';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.boxShadow = '0 1px 2px 0 rgb(0 0 0 / 0.05)';
      e.currentTarget.style.transform = 'translateY(0)';
    }}
    >
      <Link to={`/products/${product._id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
        <div style={{ position: 'relative' }}>
          <img
            src={image}
            alt={product.name}
            style={{
              width: '100%',
              height: '220px',
              objectFit: 'cover',
              display: 'block',
            }}
          />
          {product.discountPercentage > 0 && (
            <span style={{
              position: 'absolute',
              top: '0.6rem',
              left: '0.6rem',
              fontSize: '0.75rem',
              fontWeight: '600',
              background: '#dc2626',
              color: '#ffffff',
              padding: '0.2rem 0.55rem',
              borderRadius: '9999px',
            }}>
              {product.discountPercentage}% OFF
            </span>
          )}
        </div>
        <div style={{ padding: '1.1rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
          <p style={{
            fontSize: '0.78rem',
            fontWeight: '500',
            color: '#6b7280',
            marginBottom: '0.35rem',
            textTransform: 'uppercase',
            letterSpacing: '0.03em',
          }}>
            {product.category?.name || 'Uncategorized'}
          </p>

          <h3 style={{
            fontSize: '1rem',
            fontWeight: '600',
            color: '#111827',
            marginBottom: '0.5rem',
            lineHeight: '1.35',
          }}>
            {product.name}
          </h3>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '1.15rem', fontWeight: '700', color: '#111827' }}>
              ₹{product.price.toLocaleString()}
            </span>
            {product.comparePrice && product.comparePrice > product.price && (
              <span style={{
                fontSize: '0.85rem',
                color: '#9ca3af',
                textDecoration: 'line-through',
              }}>
                ₹{product.comparePrice.toLocaleString()}
              </span>
            )}
          </div>

          <div style={{
            fontSize: '0.8rem',
            fontWeight: '500',
            color: inStock ? '#16a34a' : '#dc2626',
            marginBottom: '0.85rem',
          }}>
            {inStock ? `${product.stock} in stock` : 'Out of stock'}
          </div>
        </div>
      </Link>

      <div style={{ padding: '0 1.1rem 1.1rem', display: 'flex', gap: '0.5rem' }} onClick={(e) => e.preventDefault()}>
        {onAddToCart && inStock && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!user) {
                alert('Please login to add items to cart');
                navigate('/login');
                return;
              }
              onAddToCart(product._id);
            }}
            style={{
              flex: 1,
              padding: '0.6rem',
              background: '#4f46e5',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: '600',
            }}
          >
            Add to Cart
          </button>
        )}
        {onAddToCart && !inStock && (
          <button
            disabled
            style={{
              flex: 1,
              padding: '0.6rem',
              background: '#e5e7eb',
              color: '#9ca3af',
              border: 'none',
              borderRadius: '8px',
              cursor: 'not-allowed',
              fontSize: '0.9rem',
              fontWeight: '600',
            }}
          >
            Out of Stock
          </button>
        )}
        {onToggleWishlist && (
          <button
            onClick={() => onToggleWishlist(product._id)}
            style={{
              padding: '0.6rem 0.8rem',
              background: isInWishlist ? '#fce7f3' : '#f3f4f6',
              color: isInWishlist ? '#db2777' : '#6b7280',
              border: '1px solid',
              borderColor: isInWishlist ? '#fbcfe8' : '#e5e7eb',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '1.1rem',
              lineHeight: 1,
            }}
            title={isInWishlist ? 'Remove from Wishlist' : 'Add to Wishlist'}
          >
            {isInWishlist ? '❤️' : '🤍'}
          </button>
        )}
      </div>
    </div>
  );
}
