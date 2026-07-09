const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { protect } = require('../middleware/authMiddleware');

// @route   GET /api/notifications
// @desc    Get user's notifications
// @access  Private
router.get('/', protect, notificationController.getNotifications);

// @route   GET /api/notifications/unread-count
// @desc    Get unread notification count
// @access  Private
router.get('/unread-count', protect, notificationController.getUnreadCount);

// @route   PUT /api/notifications/:id/read
// @desc    Mark notification as read
// @access  Private
router.put('/:id/read', protect, notificationController.markAsRead);

// @route   PUT /api/notifications/read-all
// @desc    Mark all notifications as read
// @access  Private
router.put('/read-all', protect, notificationController.markAllAsRead);

// @route   DELETE /api/notifications/:id
// @desc    Delete notification
// @access  Private
router.delete('/:id', protect, notificationController.deleteNotification);

// @route   POST /api/notifications/create
// @desc    Create notification (internal use)
// @access  Private (Admin/System)
router.post('/create', protect, notificationController.createNotification);

module.exports = router;