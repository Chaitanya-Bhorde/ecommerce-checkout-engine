const express = require('express');
const router = express.Router();
const { getAnalytics, getRealTimeStats, getSatisfactionMetrics, logChatInteraction } = require('../services/ai/analyticsService');
const { protect, admin } = require('../middleware/authMiddleware');

// @route   POST /api/ai/analytics/log
// @desc    Log chat interaction
// @access  Private
router.post('/log', protect, async (req, res) => {
  try {
    const { message, response, action, actionResult, responseTime } = req.body;
    const userId = req.user._id;

    const log = await logChatInteraction(userId, message, response, action, actionResult, responseTime);

    res.status(201).json({
      success: true,
      data: log,
    });
  } catch (error) {
    console.error('Log analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to log interaction',
    });
  }
});

// @route   GET /api/ai/analytics/dashboard
// @desc    Get analytics dashboard data
// @access  Private/Admin
router.get('/dashboard', protect, admin, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const analytics = await getAnalytics(days);
    const realTimeStats = await getRealTimeStats();
    const satisfactionMetrics = await getSatisfactionMetrics(days);

    res.status(200).json({
      success: true,
      analytics,
      realTimeStats,
      satisfactionMetrics,
    });
  } catch (error) {
    console.error('Dashboard analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard data',
    });
  }
});

// @route   GET /api/ai/analytics/realtime
// @desc    Get real-time stats
// @access  Private/Admin
router.get('/realtime', protect, admin, async (req, res) => {
  try {
    const stats = await getRealTimeStats();

    res.status(200).json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error('Real-time stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch real-time stats',
    });
  }
});

// @route   GET /api/ai/analytics/satisfaction
// @desc    Get satisfaction metrics
// @access  Private/Admin
router.get('/satisfaction', protect, admin, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const metrics = await getSatisfactionMetrics(days);

    res.status(200).json({
      success: true,
      metrics,
    });
  } catch (error) {
    console.error('Satisfaction metrics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch satisfaction metrics',
    });
  }
});

// @route   GET /api/ai/analytics/top-queries
// @desc    Get most common queries
// @access  Private/Admin
router.get('/top-queries', protect, admin, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const analytics = await getAnalytics(days);

    res.status(200).json({
      success: true,
      topQueries: analytics.topQueries,
    });
  } catch (error) {
    console.error('Top queries error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch top queries',
    });
  }
});

// @route   GET /api/ai/analytics/actions
// @desc    Get action breakdown
// @access  Private/Admin
router.get('/actions', protect, admin, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const analytics = await getAnalytics(days);

    res.status(200).json({
      success: true,
      actionBreakdown: analytics.actionBreakdown,
      actionsPerformed: analytics.actionsPerformed,
      successfulActions: analytics.successfulActions,
      failedActions: analytics.failedActions,
      actionSuccessRate: analytics.actionSuccessRate,
    });
  } catch (error) {
    console.error('Actions analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch actions analytics',
    });
  }
});

// @route   GET /api/ai/analytics/response-time
// @desc    Get response time analytics
// @access  Private/Admin
router.get('/response-time', protect, admin, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const analytics = await getAnalytics(days);

    res.status(200).json({
      success: true,
      avgResponseTime: analytics.avgResponseTime,
      responseTimeDistribution: analytics.responseTimeDistribution,
      dailyConversations: analytics.dailyConversations,
    });
  } catch (error) {
    console.error('Response time analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch response time analytics',
    });
  }
});

module.exports = router;