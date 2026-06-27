import { useState, useEffect } from 'react';
import { api } from '../services/api';
import ProductCard from '../components/ProductCard';
import { useAuth } from '../contexts/AuthContext';

export default function Products() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [filters, setFilters] = useState({
    search: '',
    category: '',
    sort: '',
    inStock: false,
    page: 1,
  });
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await api.get('/categories?isActive=true');
        setCategories(res.data);
      } catch (err) {
        console.error('Failed to fetch categories', err);
      }
    };
    fetchCategories();
  }, []);

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (filters.search) params.set('search', filters.search);
        if (filters.category) params.set('category', filters.category);
        if (filters.sort) params.set('sort', filters.sort);
        if (filters.inStock) params.set('inStock', 'true');
        params.set('page', String(filters.page));
        params.set('limit', '12');

        const res = await api.get(`/products?${params.toString()}`);
        setProducts(res.data.products);
        setPagination(res.data.pagination);
      } catch (err) {
        console.error('Failed to fetch products', err);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, [filters.search, filters.category, filters.sort, filters.inStock, filters.page]);

  const addToCart = async (productId) => {
    if (!user) {
      alert('Please login to add items to cart');
      return;
    }
    try {
      await api.post('/cart', { productId, quantity: 1 });
      alert('Added to cart!');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to add to cart');
    }
  };

  const filterBarStyle = {
    display: 'flex',
    gap: '0.75rem',
    marginBottom: '2rem',
    flexWrap: 'wrap',
    alignItems: 'center',
    padding: '1.1rem 1.25rem',
    background: '#ffffff',
    borderRadius: '12px',
    border: '1px solid #e5e7eb',
    boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  };

  const selectStyle = {
    padding: '0.55rem 0.75rem',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    background: '#ffffff',
    fontSize: '0.92rem',
    minWidth: '150px',
  };

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '2rem 1.25rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.7rem', fontWeight: '700', color: '#111827' }}>Products</h1>
        <p style={{ color: '#6b7280', fontSize: '0.95rem', marginTop: '0.2rem' }}>
          Browse our collection
        </p>
      </div>

      <div style={filterBarStyle}>
        <input
          type="text"
          placeholder="Search products..."
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          style={{
            padding: '0.55rem 0.85rem',
            border: '1px solid #d1d5db',
            borderRadius: '8px',
            minWidth: '220px',
            fontSize: '0.92rem',
          }}
        />

        <select
          value={filters.category}
          onChange={(e) => setFilters({ ...filters, category: e.target.value })}
          style={selectStyle}
        >
          <option value="">All Categories</option>
          {categories.map((cat) => (
            <option key={cat._id} value={cat._id}>{cat.name}</option>
          ))}
        </select>

        <select
          value={filters.sort}
          onChange={(e) => setFilters({ ...filters, sort: e.target.value })}
          style={selectStyle}
        >
          <option value="">Sort By</option>
          <option value="price_asc">Price: Low to High</option>
          <option value="price_desc">Price: High to Low</option>
          <option value="rating">Top Rated</option>
          <option value="newest">Newest</option>
        </select>

        <label style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontSize: '0.9rem',
          fontWeight: '500',
          color: '#374151',
          cursor: 'pointer',
          userSelect: 'none',
        }}>
          <input
            type="checkbox"
            checked={filters.inStock}
            onChange={(e) => setFilters({ ...filters, inStock: e.target.checked })}
            style={{ width: '16px', height: '16px', accentColor: '#4f46e5' }}
          />
          In stock only
        </label>
      </div>

      {loading ? (
        <p style={{ textAlign: 'center', padding: '2rem' }}>Loading products...</p>
      ) : products.length === 0 ? (
        <p style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>No products found.</p>
      ) : (
        <>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
            gap: '1.5rem',
          }}>
            {products.map((product) => (
              <ProductCard key={product._id} product={product} onAddToCart={addToCart} />
            ))}
          </div>

          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '1rem',
            marginTop: '2rem',
            padding: '1rem 0',
          }}>
            <span style={{ fontSize: '0.9rem', color: '#6b7280' }}>
              Page {pagination.page} of {pagination.pages} ({pagination.total} products)
            </span>
            <button
              disabled={pagination.page <= 1}
              onClick={() => setFilters({ ...filters, page: pagination.page - 1 })}
              style={{
                padding: '0.4rem 0.8rem',
                opacity: pagination.page <= 1 ? 0.5 : 1,
              }}
            >
              Previous
            </button>
            <button
              disabled={!pagination.hasNextPage}
              onClick={() => setFilters({ ...filters, page: pagination.page + 1 })}
              style={{
                padding: '0.4rem 0.8rem',
                opacity: !pagination.hasNextPage ? 0.5 : 1,
              }}
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}
