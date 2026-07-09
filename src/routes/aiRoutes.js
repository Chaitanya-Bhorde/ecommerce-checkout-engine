const express = require('express');
const router = express.Router();
const { chat, clearChatHistory, getChatHistory, getConversations, deleteConversation, shouldEscalateToHuman, getSuggestedReplies } = require('../services/ai/chatbot');
const { runAgent } = require('../services/ai/agentWorkflow');
const { protect } = require('../middleware/authMiddleware');
const Conversation = require('../models/Conversation');
const ChatMessage = require('../models/ChatMessage');
const SupportTicket = require('../models/SupportTicket');

// @route   POST /api/ai/chat
// @desc    Send message to AI chatbot
// @access  Private
router.post('/chat', protect, async (req, res) => {
  try {
    const { message, conversationId } = req.body;
    const authenticatedUserId = req.user._id;
    const userName = req.user.name || 'Customer';
    const userEmail = req.user.email || '';

    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a message',
      });
    }

    console.log(`[AI Route] User: ${userName} (${userEmail}) asked: "${message}"`);

    const agentResult = await runAgent(authenticatedUserId.toString(), message);

    let response;
    let chatResult = null;
    if (agentResult.handledByAgent) {
      console.log(`[AI Route] Handled by agent (action: ${agentResult.action || 'confirmation/none'})`);
      response = agentResult.response;
      
      // Save agent-handled messages to conversation history
      let currentConversationId = conversationId;
      if (!currentConversationId) {
        const title = message.substring(0, 40) + (message.length > 40 ? '...' : '');
        const conversation = await Conversation.create({
          userId: String(authenticatedUserId),
          title: title,
        });
        currentConversationId = conversation._id;
      }
      
      await ChatMessage.create({
        conversationId: currentConversationId,
        userId: String(authenticatedUserId),
        role: 'user',
        content: message,
      });
      
      await ChatMessage.create({
        conversationId: currentConversationId,
        userId: String(authenticatedUserId),
        role: 'assistant',
        content: response,
      });
      
      await Conversation.findByIdAndUpdate(currentConversationId, { updatedAt: Date.now() });
      
      chatResult = {
        response: response,
        conversationId: currentConversationId.toString(),
        escalate: false,
        ticketId: null,
      };
    } else {
      console.log('[AI Route] General query - using chat() with conversation support');
      chatResult = await chat(authenticatedUserId.toString(), message, {
        userName,
        userEmail,
        userRole: req.user.role,
      }, conversationId);
      response = chatResult.response;
    }

    const suggestions = getSuggestedReplies(authenticatedUserId, chatResult.conversationId);

    res.status(200).json({
      success: true,
      response,
      suggestions,
      escalate: chatResult.escalate,
      ticketId: chatResult.ticketId,
      conversationId: chatResult.conversationId,
    });
  } catch (error) {
    console.error('Chat API error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get AI response. Please try again.',
    });
  }
});

// @route   GET /api/ai/conversations
// @desc    Get all conversations for the logged-in user
// @access  Private
router.get('/conversations', protect, async (req, res) => {
  try {
    const userId = String(req.user._id);
    const conversations = await getConversations(userId);

    res.status(200).json({
      success: true,
      conversations,
    });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load conversations',
    });
  }
});

// @route   GET /api/ai/conversations/:conversationId/messages
// @desc    Get messages for a specific conversation
// @access  Private
router.get('/conversations/:conversationId/messages', protect, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = String(req.user._id);

    const conversation = await Conversation.findOne({ _id: conversationId, userId });
    if (!conversation) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access',
      });
    }

    const messages = await getChatHistory(conversationId);

    res.status(200).json({
      success: true,
      messages,
    });
  } catch (error) {
    console.error('Get conversation messages error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load messages',
    });
  }
});

// @route   POST /api/ai/conversations/new
// @desc    Create a new empty conversation
// @access  Private
router.post('/conversations/new', protect, async (req, res) => {
  try {
    const userId = String(req.user._id);
    const conversation = await Conversation.create({
      userId: userId,
      title: 'New Chat',
    });

    res.status(201).json({
      success: true,
      conversationId: conversation._id,
    });
  } catch (error) {
    console.error('Create conversation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create conversation',
    });
  }
});

// @route   DELETE /api/ai/conversations/:conversationId
// @desc    Delete a conversation and all its messages
// @access  Private
router.delete('/conversations/:conversationId', protect, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = String(req.user._id);

    const deleted = await deleteConversation(conversationId, userId);
    if (!deleted) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized or conversation not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Conversation deleted',
    });
  } catch (error) {
    console.error('Delete conversation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete conversation',
    });
  }
});

// @route   GET /api/ai/chat/history/:userId
// @desc    Get chat history for a user (legacy endpoint)
// @access  Private
router.get('/chat/history/:userId', protect, async (req, res) => {
  try {
    const { userId } = req.params;
    const authenticatedUserId = req.user._id;

    if (userId !== 'guest' && userId !== authenticatedUserId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access',
      });
    }

    const history = await getChatHistory(userId);

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

    if (userId !== 'guest' && userId !== authenticatedUserId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access',
      });
    }

    await clearChatHistory(userId);

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

// @route   GET /api/ai/admin/support-tickets
// @desc    Get all support tickets (Admin only)
// @access  Private/Admin
router.get('/admin/support-tickets', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required',
      });
    }

    const tickets = await SupportTicket.find({})
      .sort({ createdAt: -1 })
      .limit(100);

    res.status(200).json({
      success: true,
      tickets,
    });
  } catch (error) {
    console.error('Get support tickets error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load support tickets',
    });
  }
});

// @route   PATCH /api/ai/admin/support-tickets/:id/resolve
// @desc    Mark a support ticket as resolved (Admin only)
// @access  Private/Admin
router.patch('/admin/support-tickets/:id/resolve', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required',
      });
    }

    const { id } = req.params;
    const ticket = await SupportTicket.findByIdAndUpdate(
      id,
      { status: 'resolved' },
      { new: true }
    );

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found',
      });
    }

    res.status(200).json({
      success: true,
      ticket,
    });
  } catch (error) {
    console.error('Resolve ticket error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to resolve ticket',
    });
  }
});

// @route   POST /api/ai/admin/init-vector-store
// @desc    Initialize vector store with knowledge base (Admin only)
// @access  Private/Admin
router.post('/admin/init-vector-store', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required',
      });
    }

    const { vectorStore } = require('../services/ai/vectorStore');
    const { knowledgeBase } = require('../services/ai/knowledgeBase');

    const initialized = await vectorStore.init();
    
    if (!initialized) {
      return res.status(500).json({
        success: false,
        message: 'Failed to initialize vector store',
      });
    }

    await vectorStore.clearAll();

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
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required',
      });
    }

    const { vectorStore } = require('../services/ai/vectorStore');
    const { knowledgeBase } = require('../services/ai/knowledgeBase');

    await vectorStore.clearAll();

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