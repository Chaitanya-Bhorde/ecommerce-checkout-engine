import { useState, useEffect } from 'react';
import { api } from '../services/api';

export default function AdminLedger() {
  const [entries, setEntries] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    status: '',
    type: '',
    startDate: '',
    endDate: '',
  });

  useEffect(() => {
    fetchLedgerEntries();
  }, [filters]);

  const fetchLedgerEntries = async () => {
    try {
      const params = new URLSearchParams();
      params.append('limit', '50');
      params.append('page', '1');
      if (filters.status) params.append('status', filters.status);
      if (filters.type) params.append('type', filters.type);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);

      const res = await api.get(`/payments/ledger?${params.toString()}`);
      setEntries(res.data.entries || []);
      setPagination(res.data.pagination);
      setSummary(res.data.summary);
    } catch (err) {
      setError('Failed to load ledger entries');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters({ ...filters, [name]: value });
  };

  const clearFilters = () => {
    setFilters({
      status: '',
      type: '',
      startDate: '',
      endDate: '',
    });
  };

  if (loading) {
    return (
      <div className="admin-page">
        <div className="container">
          <div className="loading-spinner"></div>
          <p className="loading-text">Loading ledger...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="container">
        <div className="admin-header">
          <div>
            <h1 className="admin-title">Financial Ledger</h1>
            <p className="admin-subtitle">Track all financial transactions and payments</p>
          </div>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {/* Summary Cards */}
        {summary && (
          <div className="summary-cards">
            <div className="summary-card">
              <div className="summary-icon">💰</div>
              <div className="summary-content">
                <p className="summary-label">Total Transactions</p>
                <p className="summary-value">{summary.totalEntries}</p>
              </div>
            </div>
            <div className="summary-card">
              <div className="summary-icon">💵</div>
              <div className="summary-content">
                <p className="summary-label">Total Amount</p>
                <p className="summary-value">₹{summary.totalAmount.toFixed(2)}</p>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="admin-section">
          <div className="filters-bar">
            <div className="filter-group">
              <label>Status:</label>
              <select
                name="status"
                value={filters.status}
                onChange={handleFilterChange}
                className="filter-select"
              >
                <option value="">All</option>
                <option value="pending">Pending</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
              </select>
            </div>
            <div className="filter-group">
              <label>Type:</label>
              <select
                name="type"
                value={filters.type}
                onChange={handleFilterChange}
                className="filter-select"
              >
                <option value="">All</option>
                <option value="payment">Payment</option>
                <option value="refund">Refund</option>
              </select>
            </div>
            <div className="filter-group">
              <label>Start Date:</label>
              <input
                type="date"
                name="startDate"
                value={filters.startDate}
                onChange={handleFilterChange}
                className="filter-input"
              />
            </div>
            <div className="filter-group">
              <label>End Date:</label>
              <input
                type="date"
                name="endDate"
                value={filters.endDate}
                onChange={handleFilterChange}
                className="filter-input"
              />
            </div>
            <button onClick={clearFilters} className="btn-secondary">
              Clear Filters
            </button>
          </div>
        </div>

        {/* Ledger Table */}
        <div className="admin-section">
          <div className="ledger-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Order ID</th>
                  <th>Customer</th>
                  <th>Amount</th>
                  <th>Payment Method</th>
                  <th>Status</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {entries.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="no-data">
                      No ledger entries found
                    </td>
                  </tr>
                ) : (
                  entries.map((entry) => (
                    <tr key={entry._id}>
                      <td>{new Date(entry.createdAt).toLocaleDateString()}</td>
                      <td>
                        <span className={`type-badge type-${entry.type}`}>
                          {entry.type}
                        </span>
                      </td>
                      <td>
                        <span className="order-id">#{entry.order?._id?.slice(-8) || 'N/A'}</span>
                      </td>
                      <td>
                        <span className="customer-name">{entry.user?.name || 'N/A'}</span>
                      </td>
                      <td>
                        <span className="amount">₹{entry.amount.toFixed(2)}</span>
                      </td>
                      <td>
                        <span className="payment-method">{entry.paymentMethod || 'N/A'}</span>
                      </td>
                      <td>
                        <span className={`status-badge status-${entry.status === 'completed' ? 'confirmed' : entry.status}`}>
                          {entry.status}
                        </span>
                      </td>
                      <td>
                        <span className="description">{entry.description || 'N/A'}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination && pagination.pages > 1 && (
            <div className="pagination">
              <button
                className="btn-pagination"
                disabled={!pagination.hasPrevPage}
                onClick={() => fetchLedgerEntries()}
              >
                ← Previous
              </button>
              <span className="page-info">
                Page {pagination.page} of {pagination.pages}
              </span>
              <button
                className="btn-pagination"
                disabled={!pagination.hasNextPage}
                onClick={() => fetchLedgerEntries()}
              >
                Next →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}