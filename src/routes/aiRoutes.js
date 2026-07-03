const express = require('express');
const router = express.Router();
const { chat, clearChatHistory, getChatHistory, shouldEscalateToHuman, getSuggestedReplies } = require('../services/ai/chatbot');
const { protect } = require('../middleware/authMiddleware');

// @route   POST /api/ai/chat
// @desc    Send message to AI chatbot
// @access  Private
router.post('/chat', protect, async (req, res) => {
  try {
    const { message, userId } = req.body;
    const authenticatedUserId = req.user._id; // Use authenticated user ID

    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a message',
      });
    }

    // Get AI response with real database data
    const response = await chat(authenticatedUserId, message, {
      userId: authenticatedUserId,
    });

    // Get suggestions for next message
    const suggestions = getSuggestedReplies(authenticatedUserId);

    // Check if should escalate to human
    const escalate = shouldEscalateToHuman(message);

    res.status(200).json({
      success: true,
      response,
      suggestions,
      escalate,
    });
  } catch (error) {
    console.error('Chat API error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get AI response. Please try again.',
    });
  }
});

// @route   GET /api/ai/chat/history/:userId
// @desc    Get chat history for a user
// @access  Private
router.get('/chat/history/:userId', protect, async (req, res) => {
  try {
    const { userId } = req.params;
    const authenticatedUserId = req.user._id;

    // Ensure user can only access their own history
    if (userId !== 'guest' && userId !== authenticatedUserId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access',
      });
    }

    const history = getChatHistory(userId);

    res.status(200).json({
      success: true,
      history,
    });
  } catch (error) {
    console.error('Chat history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load chat history',
    });
  }
});

// @route   POST /api/ai/chat/clear
// @desc    Clear chat history for a user
// @access  Private
router.post('/chat/clear', protect, async (req, res) => {
  try {
    const { userId } = req.body;
    const authenticatedUserId = req.user._id;

    // Ensure user can only clear their own history
    if (userId !== 'guest' && userId !== authenticatedUserId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access',
      });
    }

    clearChatHistory(userId);

    res.status(200).json({
      success: true,
      message: 'Chat history cleared',
    });
  } catch (error) {
    console.error('Clear chat error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear chat history',
    });
  }
});

// @route   GET /api/ai/chat/suggestions/:userId
// @desc    Get suggested quick replies
// @access  Private
router.get('/chat/suggestions/:userId', protect, async (req, res) => {
  try {
    const { userId } = req.params;
    const authenticatedUserId = req.user._id;

    // Ensure user can only access their own suggestions
    if (userId !== 'guest' && userId !== authenticatedUserId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access',
      });
    }

    const suggestions = getSuggestedReplies(userId);

    res.status(200).json({
      success: true,
      suggestions,
    });
  } catch (error) {
    console.error('Suggestions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load suggestions',
    });
  }
});

// @route   POST /api/ai/admin/init-vector-store
// @desc    Initialize vector store with knowledge base (Admin only)
// @access  Private/Admin
router.post('/admin/init-vector-store', protect, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required',
      });
    }

    const { vectorStore } = require('../services/ai/vectorStore');
    const { knowledgeBase } = require('../services/ai/knowledgeBase');

    // Initialize vector store
    const initialized = await vectorStore.init();
    
    if (!initialized) {
      return res.status(500).json({
        success: false,
        message: 'Failed to initialize vector store',
      });
    }

    // Clear existing data
    await vectorStore.clearAll();

    // Add all knowledge base documents
    const documents = knowledgeBase.map(doc => ({
      id: doc.id,
      content: doc.content,
      metadata: doc.metadata,
    }));

    await vectorStore.bulkAddDocuments(documents);

    const stats = await vectorStore.getStats();

    res.status(200).json({
      success: true,
      message: 'Vector store initialized successfully',
      stats,
    });
  } catch (error) {
    console.error('Vector store init error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to initialize vector store',
    });
  }
});

// @route   GET /api/ai/admin/vector-store/stats
// @desc    Get vector store statistics (Admin only)
// @access  Private/Admin
router.get('/admin/vector-store/stats', protect, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required',
      });
    }

    const { vectorStore } = require('../services/ai/vectorStore');
    const stats = await vectorStore.getStats();

    res.status(200).json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error('Vector store stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get vector store stats',
    });
  }
});

// @route   POST /api/ai/admin/knowledge-base/seed
// @desc    Re-seed knowledge base (Admin only)
// @access  Private/Admin
router.post('/admin/knowledge-base/seed', protect, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required',
      });
    }

    const { vectorStore } = require('../services/ai/vectorStore');
    const { knowledgeBase } = require('../services/ai/knowledgeBase');

    // Clear existing data
    await vectorStore.clearAll();

    // Re-add all documents
    const documents = knowledgeBase.map(doc => ({
      id: doc.id,
      content: doc.content,
      metadata: doc.metadata,
    }));

    await vectorStore.bulkAddDocuments(documents);

    const stats = await vectorStore.getStats();

    res.status(200).json({
      success: true,
      message: 'Knowledge base re-seeded successfully',
      stats,
    });
  } catch (error) {
    console.error('Knowledge base seed error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to re-seed knowledge base',
    });
  }
});

module.exports = router;