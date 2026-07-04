import { useState, useEffect } from 'react';
import axios from 'axios';
import './AdminAIAnalytics.css';

export default function AdminAIAnalytics() {
  const [analytics, setAnalytics] = useState(null);
  const [realTimeStats, setRealTimeStats] = useState(null);
  const [satisfaction, setSatisfaction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState(7);

  useEffect(() => {
    fetchAnalytics();
    const interval = setInterval(fetchRealTimeStats, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, [timeRange]);

  const fetchAnalytics = async () => {
    try {
      const token = localStorage.getItem('token');
      const [analyticsRes, satisfactionRes] = await Promise.all([
        axios.get(`/api/ai/analytics/dashboard?days=${timeRange}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`/api/ai/analytics/satisfaction?days=${timeRange}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      setAnalytics(analyticsRes.data.analytics);
      setRealTimeStats(analyticsRes.data.realTimeStats);
      setSatisfaction(satisfactionRes.data.metrics);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      setLoading(false);
    }
  };

  const fetchRealTimeStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/ai/analytics/realtime', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setRealTimeStats(res.data.stats);
    } catch (error) {
      console.error('Error fetching real-time stats:', error);
    }
  };

  if (loading) {
    return (
      <div className="analytics-loading">
        <div className="loading-spinner"></div>
        <p>Loading analytics...</p>
      </div>
    );
  }

  return (
    <div className="analytics-container">
      <div className="analytics-header">
        <h1>AI Analytics Dashboard</h1>
        <div className="time-range-selector">
          <button 
            className={timeRange === 7 ? 'active' : ''}
            onClick={() => setTimeRange(7)}
          >
            Last 7 Days
          </button>
          <button 
            className={timeRange === 30 ? 'active' : ''}
            onClick={() => setTimeRange(30)}
          >
            Last 30 Days
          </button>
          <button 
            className={timeRange === 90 ? 'active' : ''}
            onClick={() => setTimeRange(90)}
          >
            Last 90 Days
          </button>
        </div>
      </div>

      {/* Real-Time Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">💬</div>
          <div className="stat-info">
            <h3>Conversations (24h)</h3>
            <p className="stat-value">{realTimeStats?.conversationsLast24h || 0}</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">👥</div>
          <div className="stat-info">
            <h3>Active Users (24h)</h3>
            <p className="stat-value">{realTimeStats?.uniqueUsersLast24h || 0}</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">⚡</div>
          <div className="stat-info">
            <h3>Avg Response Time</h3>
            <p className="stat-value">{realTimeStats?.avgResponseTimeLast24h || 0}ms</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">🎯</div>
          <div className="stat-info">
            <h3>Actions Performed (24h)</h3>
            <p className="stat-value">{realTimeStats?.actionsLast24h || 0}</p>
          </div>
        </div>
      </div>

      {/* Main Analytics */}
      <div className="analytics-grid">
        {/* Satisfaction Score */}
        <div className="analytics-card satisfaction-card">
          <h2>Customer Satisfaction</h2>
          <div className="satisfaction-score">
            <div className="score-circle">
              <svg viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="45" fill="none" stroke="#e5e7eb" strokeWidth="10" />
                <circle 
                  cx="50" cy="50" r="45" 
                  fill="none" 
                  stroke={satisfaction?.satisfactionScore >= 70 ? '#10b981' : satisfaction?.satisfactionScore >= 50 ? '#f59e0b' : '#ef4444'}
                  strokeWidth="10"
                  strokeDasharray={`${satisfaction?.satisfactionScore || 0} 100`}
                  strokeLinecap="round"
                  transform="rotate(-90 50 50)"
                />
              </svg>
              <div className="score-text">
                <span className="score-value">{satisfaction?.satisfactionScore || 0}</span>
                <span className="score-label">/ 100</span>
              </div>
            </div>
          </div>
          <div className="satisfaction-metrics">
            <div className="metric">
              <span className="metric-label">Escalation Rate</span>
              <span className="metric-value">{satisfaction?.escalationRate || 0}%</span>
            </div>
            <div className="metric">
              <span className="metric-label">Action Success</span>
              <span className="metric-value">{satisfaction?.actionSuccessRate || 0}%</span>
            </div>
          </div>
        </div>

        {/* Total Conversations */}
        <div className="analytics-card">
          <h2>Total Conversations</h2>
          <div className="big-number">{analytics?.totalConversations || 0}</div>
          <p className="analytics-detail">
            From {analytics?.uniqueUsers || 0} unique users
          </p>
        </div>

        {/* Average Response Time */}
        <div className="analytics-card">
          <h2>Average Response Time</h2>
          <div className="big-number">{analytics?.avgResponseTime || 0}ms</div>
          <div className="response-time-breakdown">
            <div className="rt-item">
              <span className="rt-label fast">Fast (less than 2s)</span>
              <span className="rt-value">{analytics?.responseTimeDistribution?.fast || 0}</span>
            </div>
            <div className="rt-item">
              <span className="rt-label medium">Medium (2-5s)</span>
              <span className="rt-value">{analytics?.responseTimeDistribution?.medium || 0}</span>
            </div>
            <div className="rt-item">
              <span className="rt-label slow">Slow (more than 5s)</span>
              <span className="rt-value">{analytics?.responseTimeDistribution?.slow || 0}</span>
            </div>
          </div>
        </div>

        {/* Actions Performed */}
        <div className="analytics-card">
          <h2>AI Actions Performed</h2>
          <div className="actions-grid">
            <div className="action-item">
              <span className="action-label">Total Actions</span>
              <span className="action-value">{analytics?.actionsPerformed || 0}</span>
            </div>
            <div className="action-item success">
              <span className="action-label">Successful</span>
              <span className="action-value">{analytics?.successfulActions || 0}</span>
            </div>
            <div className="action-item failed">
              <span className="action-label">Failed</span>
              <span className="action-value">{analytics?.failedActions || 0}</span>
            </div>
            <div className="action-item">
              <span className="action-label">Success Rate</span>
              <span className="action-value">{analytics?.actionSuccessRate || 0}%</span>
            </div>
          </div>
        </div>

        {/* Top Queries */}
        <div className="analytics-card wide">
          <h2>Most Common Queries</h2>
          <div className="queries-list">
            {analytics?.topQueries?.map((query, index) => (
              <div key={index} className="query-item">
                <span className="query-rank">#{index + 1}</span>
                <span className="query-intent">{query.intent}</span>
                <span className="query-count">{query.count} times</span>
                <div className="query-bar">
                  <div 
                    className="query-bar-fill" 
                    style={{ width: `${(query.count / (analytics?.topQueries?.[0]?.count || 1)) * 100}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Action Breakdown */}
        <div className="analytics-card wide">
          <h2>Action Breakdown</h2>
          <div className="action-breakdown">
            {analytics?.actionBreakdown && Object.entries(analytics.actionBreakdown).map(([action, count]) => (
              <div key={action} className="breakdown-item">
                <span className="breakdown-label">{action.replace(/([A-Z])/g, ' $1').trim()}</span>
                <div className="breakdown-bar">
                  <div 
                    className="breakdown-bar-fill" 
                    style={{ width: `${(count / (analytics?.actionsPerformed || 1)) * 100}%` }}
                  ></div>
                </div>
                <span className="breakdown-count">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Daily Conversations Chart */}
        <div className="analytics-card wide">
          <h2>Daily Conversations</h2>
          <div className="daily-chart">
            {analytics?.dailyConversations && Object.entries(analytics.dailyConversations).map(([date, count]) => (
              <div key={date} className="chart-bar-container">
                <div className="chart-bar-wrapper">
                  <div 
                    className="chart-bar" 
                    style={{ height: `${(count / Math.max(...Object.values(analytics.dailyConversations))) * 100}%` }}
                  >
                    <span className="chart-bar-value">{count}</span>
                  </div>
                </div>
                <span className="chart-date">
                  {new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}