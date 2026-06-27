import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function ProductCard({ product, onAddToCart }) {
  const { user } = useAuth();
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

      {onAddToCart && (
        <div style={{ padding: '0 1.1rem 1.1rem' }}>
          <button
            onClick={() => onAddToCart(product._id)}
            disabled={!inStock}
            style={{
              width: '100%',
              padding: '0.6rem',
              background: inStock ? '#4f46e5' : '#e5e7eb',
              color: inStock ? '#ffffff' : '#9ca3af',
              border: 'none',
              borderRadius: '8px',
              cursor: inStock ? 'pointer' : 'not-allowed',
              fontSize: '0.9rem',
              fontWeight: '600',
            }}
          >
            {inStock ? 'Add to Cart' : 'Out of Stock'}
          </button>
        </div>
      )}
    </div>
  );
}
