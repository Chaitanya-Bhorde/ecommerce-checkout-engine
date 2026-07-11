import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import './AdminProducts.css';

// Category ID to name mapping for display
const categoryNames = {
  'Electronics': 'Electronics',
  'Clothing': 'Clothing',
  'Home & Garden': 'Home & Garden',
  'Sports & Fitness': 'Sports & Fitness',
  'Books': 'Books',
  'Beauty & Health': 'Beauty & Health',
};

export default function AdminProducts() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    category: '',
    newCategory: '',
    stock: '',
    images: [],
    isActive: true,
  });

  // Fetch categories for dropdown
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
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const res = await api.get('/products?limit=50&page=1');
      setProducts(res.data.products || []);
      setPagination(res.data.pagination);
    } catch (err) {
      setError('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      let categoryId = formData.category;
      
      // If admin selected "Add New Category", create it first
      if (categoryId === '__new__' && formData.newCategory.trim()) {
        try {
          const newCategoryRes = await api.post('/categories', {
            name: formData.newCategory.trim(),
            isActive: true,
          });
          categoryId = newCategoryRes.data._id;
          // Refresh categories list
          const categoriesRes = await api.get('/categories?isActive=true');
          setCategories(categoriesRes.data);
        } catch (err) {
          alert('Failed to create category. Please try again.');
          return;
        }
      }

      const productData = {
        ...formData,
        price: Number(formData.price),
        stock: Number(formData.stock),
        category: categoryId,
        images: formData.images.filter(url => url.trim() !== ''),
      };

      if (editingProduct) {
        await api.put(`/products/${editingProduct._id}`, productData);
        alert('Product updated successfully!');
      } else {
        await api.post('/products', productData);
        alert('Product created successfully!');
      }

      setShowModal(false);
      setEditingProduct(null);
      setFormData({
        name: '',
        description: '',
        price: '',
        category: '',
        newCategory: '',
        stock: '',
        images: [],
        isActive: true,
      });
      fetchProducts();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to save product');
    }
  };

  const handleEdit = (product) => {
    console.log('Editing product:', product._id, product.name);
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description || '',
      price: product.price.toString(),
      category: product.category?._id || '',
      stock: product.stock.toString(),
      images: product.images || [],
      isActive: product.isActive,
    });
    setShowModal(true);
  };

  const handleDelete = async (productId) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    try {
      await api.delete(`/products/${productId}`);
      fetchProducts();
    } catch (err) {
      alert('Failed to delete product');
    }
  };

  const handleToggleActive = async (product) => {
    try {
      console.log('Toggling product:', product._id, 'From:', product.isActive, 'To:', !product.isActive);
      const response = await api.put(`/products/${product._id}`, { isActive: !product.isActive });
      console.log('Toggle success:', response.data);
      alert('Status updated successfully!');
      fetchProducts();
    } catch (err) {
      console.error('Toggle error:', err);
      alert('Failed: ' + (err.response?.data?.message || err.message));
    }
  };

  // Resize image to match standard product image size (800x800)
  const resizeImage = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          // Create canvas for resizing
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          // Standard size for product images (square, good quality)
          const maxSize = 800;
          let width = img.width;
          let height = img.height;
          
          // Calculate new dimensions while maintaining aspect ratio
          if (width > height) {
            if (width > maxSize) {
              height = (height * maxSize) / width;
              width = maxSize;
            }
          } else {
            if (height > maxSize) {
              width = (width * maxSize) / height;
              height = maxSize;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          
          // Draw resized image
          ctx.drawImage(img, 0, 0, width, height);
          
          // Convert to base64
          const resizedDataUrl = canvas.toDataURL('image/jpeg', 0.9);
          resolve(resizedDataUrl);
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    try {
      const resizedImages = await Promise.all(files.map(file => resizeImage(file)));
      setFormData({
        ...formData,
        images: [...formData.images, ...resizedImages]
      });
    } catch (error) {
      console.error('Error processing images:', error);
      alert('Failed to process images. Please try again.');
    }
  };

  const removeImage = (index) => {
    const newImages = formData.images.filter((_, i) => i !== index);
    setFormData({ ...formData, images: newImages });
  };

  if (loading) {
    return (
      <div className="admin-page">
        <div className="container">
          <div className="loading-spinner"></div>
          <p className="loading-text">Loading products...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="container">
        <div className="admin-header">
          <div>
            <h1 className="admin-title">Product Management</h1>
            <p className="admin-subtitle">Manage your product catalog</p>
          </div>
          <button
            onClick={() => {
              setEditingProduct(null);
              setFormData({
                name: '',
                description: '',
                price: '',
                category: '',
                newCategory: '',
                stock: '',
                images: [],
                isActive: true,
              });
              setShowModal(true);
            }}
            className="btn-primary"
          >
            + Add Product
          </button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {/* Products Grid */}
        <div className="admin-section">
          <div className="products-grid">
            {products.length === 0 ? (
              <div className="no-data-message">No products found</div>
            ) : (
              products.map((product) => (
                <div key={product._id} className="product-card">
                  <div className="product-image">
                    {product.images && product.images.length > 0 ? (
                      <img src={product.images[0]} alt={product.name} />
                    ) : (
                      <div className="image-placeholder">📷</div>
                    )}
                    {!product.isActive && <div className="inactive-badge">Inactive</div>}
                  </div>
                  <div className="product-info">
                    <h3>{product.name}</h3>
                    <p className="product-category">{product.category?.name || 'Uncategorized'}</p>
                    <p className="product-price">₹{product.price.toLocaleString('en-IN')}</p>
                    <p className="product-stock">
                      Stock: <span className={product.stock > 0 ? 'in-stock' : 'out-stock'}>
                        {product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}
                      </span>
                    </p>
                  </div>
                  <div className="product-actions">
                    <button
                      onClick={() => handleEdit(product)}
                      className="btn-edit"
                      title="Edit"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleToggleActive(product)}
                      className={`btn-toggle ${product.isActive ? 'active' : 'inactive'}`}
                      title={product.isActive ? 'Deactivate' : 'Activate'}
                    >
                      {product.isActive ? '✓' : '○'}
                    </button>
                    <button
                      onClick={() => handleDelete(product._id)}
                      className="btn-delete"
                      title="Delete"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Product Modal */}
        {showModal && (
          <div className="modal-overlay" onClick={() => setShowModal(false)}>
            <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>{editingProduct ? 'Edit Product' : 'Add New Product'}</h2>
                <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
              </div>
              <form onSubmit={handleSubmit} className="product-form">
                <div className="form-row">
                  <div className="form-group">
                    <label>Product Name *</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                <div className="form-group">
                  <label>Category *</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    required
                  >
                    <option value="">Select Category</option>
                    {categories.map((cat) => (
                      <option key={cat._id} value={cat._id}>
                        {cat.name}
                      </option>
                    ))}
                    <option value="__new__">+ Add New Category</option>
                  </select>
                  
                  {formData.category === '__new__' && (
                    <div className="new-category-input" style={{ marginTop: '0.5rem' }}>
                      <input
                        type="text"
                        placeholder="Enter new category name"
                        value={formData.newCategory}
                        onChange={(e) => setFormData({ ...formData, newCategory: e.target.value })}
                        required
                      />
                    </div>
                  )}
                </div>
                </div>

                <div className="form-group">
                  <label>Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows="4"
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Price (₹) *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Stock *</label>
                    <input
                      type="number"
                      value={formData.stock}
                      onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Product Images</label>
                  <div className="image-upload-section">
                    <div className="upload-area">
                      <input
                        type="file"
                        id="imageUpload"
                        accept="image/*"
                        multiple
                        onChange={handleImageUpload}
                        style={{ display: 'none' }}
                      />
                      <label htmlFor="imageUpload" className="upload-button">
                        📁 Click to Upload Images
                      </label>
                      <p className="upload-hint">Supports: JPG, PNG, WEBP (Max 5MB each)</p>
                    </div>
                    
                    {formData.images.length > 0 && (
                      <div className="image-preview-grid">
                        {formData.images.map((url, idx) => (
                          <div key={idx} className="image-preview-item">
                            <img src={url} alt={`Preview ${idx + 1}`} />
                            <button
                              type="button"
                              onClick={() => removeImage(idx)}
                              className="remove-image-btn"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    <div className="form-group" style={{ marginTop: '1rem' }}>
                      <label>Or paste Image URLs (one per line)</label>
                      <textarea
                        value={formData.images.join('\n')}
                        onChange={(e) => setFormData({ ...formData, images: e.target.value.split('\n').filter(url => url.trim() !== '') })}
                        rows="2"
                        placeholder="https://example.com/image1.jpg&#10;https://example.com/image2.jpg"
                      />
                    </div>
                  </div>
                </div>

                <div className="form-group checkbox-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    />
                    Active
                  </label>
                </div>

                <div className="modal-actions">
                  <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary">
                    {editingProduct ? 'Update Product' : 'Create Product'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}