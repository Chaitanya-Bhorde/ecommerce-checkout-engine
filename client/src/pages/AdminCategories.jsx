import { useState, useEffect } from 'react';
import { api } from '../services/api';

export default function AdminCategories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    isActive: true,
  });

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const res = await api.get('/categories');
      setCategories(res.data || []);
    } catch (err) {
      setError('Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingCategory) {
        await api.put(`/categories/${editingCategory._id}`, formData);
      } else {
        await api.post('/categories', formData);
      }
      setShowModal(false);
      setEditingCategory(null);
      setFormData({ name: '', description: '', isActive: true });
      fetchCategories();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to save category');
    }
  };

  const handleEdit = (category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      description: category.description || '',
      isActive: category.isActive,
    });
    setShowModal(true);
  };

  const handleDelete = async (categoryId) => {
    if (!confirm('Are you sure you want to delete this category?')) return;
    try {
      await api.delete(`/categories/${categoryId}`);
      fetchCategories();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete category');
    }
  };

  const handleToggleActive = async (category) => {
    try {
      await api.put(`/categories/${category._id}`, { isActive: !category.isActive });
      fetchCategories();
    } catch (err) {
      alert('Failed to update category status');
    }
  };

  if (loading) {
    return (
      <div className="admin-page">
        <div className="container">
          <div className="loading-spinner"></div>
          <p className="loading-text">Loading categories...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="container">
        <div className="admin-header">
          <div>
            <h1 className="admin-title">Category Management</h1>
            <p className="admin-subtitle">Organize your product categories</p>
          </div>
          <button
            onClick={() => {
              setEditingCategory(null);
              setFormData({ name: '', description: '', isActive: true });
              setShowModal(true);
            }}
            className="btn-primary"
          >
            + Add Category
          </button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {/* Categories Table */}
        <div className="admin-section">
          <div className="categories-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Category Name</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {categories.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="no-data">
                      No categories found
                    </td>
                  </tr>
                ) : (
                  categories.map((category) => (
                    <tr key={category._id}>
                      <td>
                        <span className="category-name">{category.name}</span>
                      </td>
                      <td>
                        <span className="category-description">
                          {category.description || 'No description'}
                        </span>
                      </td>
                      <td>
                        <span className={`status-badge ${category.isActive ? 'status-confirmed' : 'status-cancelled'}`}>
                          {category.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>{new Date(category.createdAt).toLocaleDateString()}</td>
                      <td>
                        <div className="action-buttons">
                          <button
                            onClick={() => handleEdit(category)}
                            className="btn-icon"
                            title="Edit"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => handleToggleActive(category)}
                            className={`btn-icon ${category.isActive ? 'active' : 'inactive'}`}
                            title={category.isActive ? 'Deactivate' : 'Activate'}
                          >
                            {category.isActive ? '✓' : '○'}
                          </button>
                          <button
                            onClick={() => handleDelete(category._id)}
                            className="btn-icon delete"
                            title="Delete"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Category Modal */}
        {showModal && (
          <div className="modal-overlay" onClick={() => setShowModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>{editingCategory ? 'Edit Category' : 'Add New Category'}</h2>
                <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
              </div>
              <form onSubmit={handleSubmit} className="category-form">
                <div className="form-group">
                  <label>Category Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    placeholder="Enter category name"
                  />
                </div>

                <div className="form-group">
                  <label>Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows="4"
                    placeholder="Enter category description"
                  />
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
                    {editingCategory ? 'Update Category' : 'Create Category'}
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