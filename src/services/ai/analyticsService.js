// AI Analytics Service - Tracks chatbot performance
// Production-level analytics for monitoring AI effectiveness

const ChatLog = require('../../models/ChatLog');

/**
 * Log chat interaction for analytics
 */
async function logChatInteraction(userId, message, response, action = null, actionResult = null, responseTime = 0) {
  try {
    const log = new ChatLog({
      userId,
      message,
      response,
      action,
      actionResult,
      responseTime,
      timestamp: new Date(),
    });

    await log.save();
    return log;
  } catch (error) {
    console.error('Error logging chat interaction:', error);
    return null;
  }
}

/**
 * Get analytics for a specific time period
 */
async function getAnalytics(days = 7) {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const logs = await ChatLog.find({
      timestamp: { $gte: startDate },
    });

    // Calculate metrics
    const totalConversations = logs.length;
    const uniqueUsers = new Set(logs.map(log => log.userId)).size;
    const avgResponseTime = logs.reduce((sum, log) => sum + (log.responseTime || 0), 0) / totalConversations || 0;
    
    // Action metrics
    const actionsPerformed = logs.filter(log => log.action).length;
    const successfulActions = logs.filter(log => log.actionResult && log.actionResult.success).length;
    const failedActions = actionsPerformed - successfulActions;
    
    // Escalation metrics
    const escalations = logs.filter(log => log.response.includes('human agent')).length;
    const escalationRate = (escalations / totalConversations) * 100 || 0;

    // Most common queries
    const queryFrequency = {};
    logs.forEach(log => {
      const intent = detectIntent(log.message);
      queryFrequency[intent] = (queryFrequency[intent] || 0) + 1;
    });

    const topQueries = Object.entries(queryFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([intent, count]) => ({ intent, count }));

    // Daily conversation count
    const dailyConversations = {};
    logs.forEach(log => {
      const date = log.timestamp.toISOString().split('T')[0];
      dailyConversations[date] = (dailyConversations[date] || 0) + 1;
    });

    // Action breakdown
    const actionBreakdown = {};
    logs.filter(log => log.action).forEach(log => {
      actionBreakdown[log.action] = (actionBreakdown[log.action] || 0) + 1;
    });

    // Response time distribution
    const responseTimeDistribution = {
      fast: logs.filter(log => log.responseTime < 2000).length,
      medium: logs.filter(log => log.responseTime >= 2000 && log.responseTime < 5000).length,
      slow: logs.filter(log => log.responseTime >= 5000).length,
    };

    return {
      success: true,
      period: days,
      totalConversations,
      uniqueUsers,
      avgResponseTime: Math.round(avgResponseTime),
      actionsPerformed,
      successfulActions,
      failedActions,
      actionSuccessRate: actionsPerformed > 0 ? ((successfulActions / actionsPerformed) * 100).toFixed(2) : 0,
      escalations,
      escalationRate: escalationRate.toFixed(2),
      topQueries,
      dailyConversations,
      actionBreakdown,
      responseTimeDistribution,
    };
  } catch (error) {
    console.error('Error getting analytics:', error);
    return {
      success: false,
      message: 'Failed to fetch analytics',
    };
  }
}

/**
 * Detect intent from message
 */
function detectIntent(message) {
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes('cancel')) return 'Cancel Order';
  if (lowerMessage.includes('return') || lowerMessage.includes('refund')) return 'Return/Refund';
  if (lowerMessage.includes('order') || lowerMessage.includes('track')) return 'Order Status';
  if (lowerMessage.includes('product') || lowerMessage.includes('recommend')) return 'Product Search';
  if (lowerMessage.includes('address')) return 'Update Address';
  if (lowerMessage.includes('discount') || lowerMessage.includes('code')) return 'Apply Discount';
  if (lowerMessage.includes('hello') || lowerMessage.includes('hi')) return 'Greeting';
  
  return 'General Inquiry';
}

/**
 * Get real-time stats
 */
async function getRealTimeStats() {
  try {
    const last24Hours = new Date();
    last24Hours.setHours(last24Hours.getHours() - 24);

    const logs = await ChatLog.find({
      timestamp: { $gte: last24Hours },
    });

    return {
      success: true,
      conversationsLast24h: logs.length,
      uniqueUsersLast24h: new Set(logs.map(log => log.userId)).size,
      avgResponseTimeLast24h: logs.length > 0 
        ? Math.round(logs.reduce((sum, log) => sum + (log.responseTime || 0), 0) / logs.length)
        : 0,
      actionsLast24h: logs.filter(log => log.action).length,
    };
  } catch (error) {
    console.error('Error getting real-time stats:', error);
    return {
      success: false,
      message: 'Failed to fetch real-time stats',
    };
  }
}

/**
 * Get user satisfaction metrics
 */
async function getSatisfactionMetrics(days = 7) {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const logs = await ChatLog.find({
      timestamp: { $gte: startDate },
    });

    // Calculate satisfaction based on:
    // 1. Escalation rate (lower is better)
    // 2. Action success rate (higher is better)
    // 3. Response time (lower is better)

    const totalConversations = logs.length;
    const escalations = logs.filter(log => log.response.includes('human agent')).length;
    const successfulActions = logs.filter(log => log.actionResult && log.actionResult.success).length;
    const totalActions = logs.filter(log => log.action).length;
    const avgResponseTime = logs.reduce((sum, log) => sum + (log.responseTime || 0), 0) / totalConversations || 0;

    // Calculate satisfaction score (0-100)
    let satisfactionScore = 100;

    // Deduct for escalations
    const escalationRate = totalConversations > 0 ? (escalations / totalConversations) : 0;
    satisfactionScore -= escalationRate * 30; // Up to 30 points deduction

    // Deduct for failed actions
    const actionSuccessRate = totalActions > 0 ? (successfulActions / totalActions) : 1;
    satisfactionScore -= (1 - actionSuccessRate) * 20; // Up to 20 points deduction

    // Deduct for slow response time
    if (avgResponseTime > 5000) {
      satisfactionScore -= 10;
    } else if (avgResponseTime > 3000) {
      satisfactionScore -= 5;
    }

    // Ensure score is between 0 and 100
    satisfactionScore = Math.max(0, Math.min(100, satisfactionScore));

    return {
      success: true,
      satisfactionScore: Math.round(satisfactionScore),
      totalConversations,
      escalations,
      escalationRate: (escalationRate * 100).toFixed(2),
      actionSuccessRate: (actionSuccessRate * 100).toFixed(2),
      avgResponseTime: Math.round(avgResponseTime),
    };
  } catch (error) {
    console.error('Error getting satisfaction metrics:', error);
    return {
      success: false,
      message: 'Failed to fetch satisfaction metrics',
    };
  }
}

module.exports = {
  logChatInteraction,
  getAnalytics,
  getRealTimeStats,
  getSatisfactionMetrics,
  detectIntent,
};