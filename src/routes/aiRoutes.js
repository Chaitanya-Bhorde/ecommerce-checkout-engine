const express = require('express');
const router = express.Router();
const { chat, clearChatHistory, getChatHistory, shouldEscalateToHuman, getSuggestedReplies } = require('../services/ai/chatbot');
const { initVectorStore, bulkAddDocuments, getStats } = require('../services/ai/vectorStore');
const { knowledgeBase } = require('../services/ai/knowledgeBase');
const { protect } = require('../middleware/authMiddleware');

// Initialize vector store on server start
let vectorStoreInitialized = false;

async function ensureVectorStore() {
  if (!vectorStoreInitialized) {
    await initVectorStore();
    await seedKnowledgeBase();
    vectorStoreInitialized = true;
  }
}

// Seed knowledge base with initial data
async function seedKnowledgeBase() {
  try {
    const stats = await getStats();
    if (stats.total === 0) {
      console.log('📚 Seeding knowledge base...');
      const documents = knowledgeBase.map(doc => ({
        id: doc.id,
        content: doc.content,
        metadata: doc.metadata,
      }));
      await bulkAddDocuments(documents);
      console.log('✅ Knowledge base seeded successfully');
    }
  } catch (error) {
    console.error('❌ Failed to seed knowledge base:', error);
  }
}

// Chat endpoint
router.post('/chat', protect, async (req, res) => {
  try {
    await ensureVectorStore();
    
    const { message, userId } = req.body;
    
    if (!message) {
      return res.status(400).json({ message: 'Message is required' });
    }

    // Get user context (order history, etc.)
    const context = {
      userId: userId || req.user._id,
      userEmail: req.user.email,
    };

    // Check if should escalate to human
    if (shouldEscalateToHuman(message)) {
      return res.json({
        response: 'I understand you\'d like to speak with a human agent. Let me connect you with our support team. Please hold on while I transfer you to a human agent who can better assist you.',
        escalateToHuman: true,
      });
    }

    // Get AI response
    const response = await chat(userId || req.user._id, message, context);

    res.json({ response });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ message: 'Failed to process chat message' });
  }
});

// Get chat history
router.get('/chat/history/:userId', protect, async (req, res) => {
  try {
    const { userId } = req.params;
    const history = getChatHistory(userId);
    res.json(history);
  } catch (error) {
    console.error('Failed to get chat history:', error);
    res.status(500).json({ message: 'Failed to get chat history' });
  }
});

// Clear chat history
router.post('/chat/clear', protect, async (req, res) => {
  try {
    const { userId } = req.body;
    clearChatHistory(userId || req.user._id);
    res.json({ message: 'Chat history cleared' });
  } catch (error) {
    console.error('Failed to clear chat:', error);
    res.status(500).json({ message: 'Failed to clear chat' });
  }
});

// Get suggested replies
router.get('/chat/suggestions/:userId', protect, async (req, res) => {
  try {
    const { userId } = req.params;
    const suggestions = getSuggestedReplies(userId || req.user._id);
    res.json({ suggestions });
  } catch (error) {
    console.error('Failed to get suggestions:', error);
    res.status(500).json({ message: 'Failed to get suggestions' });
  }
});

// Initialize vector store (admin only)
router.post('/admin/init-vector-store', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    await ensureVectorStore();
    const stats = await getStats();
    
    res.json({ 
      message: 'Vector store initialized successfully',
      stats 
    });
  } catch (error) {
    console.error('Failed to initialize vector store:', error);
    res.status(500).json({ message: 'Failed to initialize vector store' });
  }
});

// Get vector store stats (admin only)
router.get('/admin/vector-store/stats', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const stats = await getStats();
    res.json(stats);
  } catch (error) {
    console.error('Failed to get vector store stats:', error);
    res.status(500).json({ message: 'Failed to get stats' });
  }
});

// Re-seed knowledge base (admin only)
router.post('/admin/knowledge-base/seed', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    await ensureVectorStore();
    await seedKnowledgeBase();
    const stats = await getStats();
    
    res.json({ 
      message: 'Knowledge base seeded successfully',
      stats 
    });
  } catch (error) {
    console.error('Failed to seed knowledge base:', error);
    res.status(500).json({ message: 'Failed to seed knowledge base' });
  }
});

module.exports = router;