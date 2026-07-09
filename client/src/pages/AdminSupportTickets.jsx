import { useState, useEffect } from 'react';
import { api } from '../services/api';

export default function AdminSupportTickets() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    try {
      const res = await api.get('/ai/admin/support-tickets');
      setTickets(res.data.tickets || []);
    } catch (err) {
      setError('Failed to load support tickets');
    } finally {
      setLoading(false);
    }
  };

  const resolveTicket = async (ticketId) => {
    try {
      await api.patch(`/ai/admin/support-tickets/${ticketId}/resolve`);
      // Update local state
      setTickets(tickets.map(ticket => 
        ticket._id === ticketId ? { ...ticket, status: 'resolved' } : ticket
      ));
    } catch (err) {
      console.error('Failed to resolve ticket:', err);
    }
  };

  if (loading) {
    return (
      <div className="admin-page">
        <div className="container">
          <div className="loading-spinner"></div>
          <p className="loading-text">Loading support tickets...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-page">
        <div className="container">
          <div className="error-message">{error}</div>
        </div>
      </div>
    );
  }

  const openTickets = tickets.filter(t => t.status === 'open');
  const resolvedTickets = tickets.filter(t => t.status === 'resolved');

  return (
    <div className="admin-page">
      <div className="container">
        <div className="admin-header">
          <div>
            <h1 className="admin-title">Support Tickets</h1>
            <p className="admin-subtitle">Manage customer support requests</p>
          </div>
        </div>

        {/* Stats */}
        <div className="stats-grid" style={{ marginBottom: '30px' }}>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: '#fef3c7', color: '#f59e0b' }}>
              ⚠️
            </div>
            <div className="stat-content">
              <p className="stat-title">Open Tickets</p>
              <p className="stat-value">{openTickets.length}</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: '#d1fae5', color: '#10b981' }}>
              ✅
            </div>
            <div className="stat-content">
              <p className="stat-title">Resolved Tickets</p>
              <p className="stat-value">{resolvedTickets.length}</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: '#dbeafe', color: '#3b82f6' }}>
              📊
            </div>
            <div className="stat-content">
              <p className="stat-title">Total Tickets</p>
              <p className="stat-value">{tickets.length}</p>
            </div>
          </div>
        </div>

        {/* Open Tickets */}
        <div className="admin-section">
          <div className="section-header">
            <h2>Open Tickets</h2>
          </div>
          {openTickets.length === 0 ? (
            <div className="no-data">No open tickets</div>
          ) : (
            <div className="tickets-list">
              {openTickets.map((ticket) => (
                <div key={ticket._id} className="ticket-card">
                  <div className="ticket-header">
                    <div className="ticket-user">
                      <span className="ticket-name">{ticket.userName}</span>
                      <span className="ticket-email">{ticket.userEmail}</span>
                    </div>
                    <span className="ticket-time">
                      {new Date(ticket.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="ticket-reason">
                    <strong>Reason:</strong> {ticket.reason}
                  </div>
                  <div className="ticket-footer">
                    <span className="ticket-id">Ticket #{ticket._id.slice(-8)}</span>
                    <button
                      onClick={() => resolveTicket(ticket._id)}
                      className="btn-primary"
                    >
                      Mark Resolved
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Resolved Tickets */}
        {resolvedTickets.length > 0 && (
          <div className="admin-section">
            <div className="section-header">
              <h2>Resolved Tickets</h2>
            </div>
            <div className="tickets-list">
              {resolvedTickets.map((ticket) => (
                <div key={ticket._id} className="ticket-card resolved">
                  <div className="ticket-header">
                    <div className="ticket-user">
                      <span className="ticket-name">{ticket.userName}</span>
                      <span className="ticket-email">{ticket.userEmail}</span>
                    </div>
                    <span className="ticket-time">
                      {new Date(ticket.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="ticket-reason">
                    <strong>Reason:</strong> {ticket.reason}
                  </div>
                  <div className="ticket-footer">
                    <span className="ticket-id">Ticket #{ticket._id.slice(-8)}</span>
                    <span className="resolved-badge">✓ Resolved</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}