import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import { useNavigate } from 'react-router-dom';
import './Chat.css';

export default function Chat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [currentConversationId, setCurrentConversationId] = useState(() => {
    // Restore last conversation ID from localStorage
    return localStorage.getItem('lastConversationId');
  });
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const { user } = useAuth();
  const navigate = useNavigate();

  // Load conversations on mount
  useEffect(() => {
    if (user) {
      loadConversations();
    }
  }, [user]);

  // Save current conversation ID to localStorage whenever it changes
  useEffect(() => {
    if (currentConversationId) {
      localStorage.setItem('lastConversationId', currentConversationId);
    }
  }, [currentConversationId]);

  // Load the last conversation from localStorage on mount
  useEffect(() => {
    const savedConversationId = localStorage.getItem('lastConversationId');
    if (savedConversationId && user) {
      // Verify the conversation belongs to this user
      const verifyAndLoad = async () => {
        try {
          await loadConversationMessages(savedConversationId);
        } catch (error) {
          // If 403 or any error, clear the saved conversation
          console.log('Could not load saved conversation, clearing...');
          localStorage.removeItem('lastConversationId');
          setCurrentConversationId(null);
        }
      };
      verifyAndLoad();
    }
  }, [user]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadConversations = async () => {
    try {
      const res = await api.get('/ai/conversations');
      if (res.data.success) {
        setConversations(res.data.conversations || []);
      }
    } catch (error) {
      console.error('Error loading conversations:', error);
    }
  };

  const loadConversationMessages = async (conversationId) => {
    try {
      setLoading(true);
      const res = await api.get(`/ai/conversations/${conversationId}/messages`);
      if (res.data.success) {
        const messagesWithDates = res.data.messages.map(msg => ({
          ...msg,
          timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
        }));
        setMessages(messagesWithDates);
        setCurrentConversationId(conversationId);
      }
    } catch (error) {
      console.error('Error loading conversation messages:', error);
      throw error; // Re-throw so the caller can handle it
    } finally {
      setLoading(false);
    }
  };

  const createNewConversation = async () => {
    try {
      const res = await api.post('/ai/conversations/new');
      if (res.data.success) {
        setCurrentConversationId(res.data.conversationId);
        setMessages([]);
        // Refresh conversations list
        loadConversations();
      }
    } catch (error) {
      console.error('Error creating conversation:', error);
    }
  };

  const deleteConversation = async (conversationId, e) => {
    e.stopPropagation();
    try {
      const res = await api.delete(`/ai/conversations/${conversationId}`);
      if (res.data.success) {
        // Remove from list
        setConversations(conversations.filter(c => c.id !== conversationId));
        // Clear current view if this was the active conversation
        if (currentConversationId === conversationId) {
          setCurrentConversationId(null);
          setMessages([]);
        }
      }
    } catch (error) {
      console.error('Error deleting conversation:', error);
    }
  };

  const sendMessage = async (text = input) => {
    if (!text.trim() || loading) return;

    const userMessage = {
      role: 'user',
      content: text,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const res = await api.post('/ai/chat', {
        message: text,
        conversationId: currentConversationId,
      });

      const data = res.data;

      if (data.success) {
        const aiMessage = {
          role: 'assistant',
          content: data.response,
          timestamp: new Date(),
          escalate: data.escalate,
        };
        setMessages(prev => [...prev, aiMessage]);
        
        // Update current conversation ID if this was a new conversation
        if (data.conversationId && !currentConversationId) {
          setCurrentConversationId(data.conversationId);
          // Refresh conversations list to show the new conversation
          loadConversations();
        }
      } else {
        console.error('API error:', data);
      }

      setLoading(false);
    } catch (error) {
      console.error('Chat error:', error);
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Check file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('File size must be less than 5MB');
        return;
      }
      // Check file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
      if (!allowedTypes.includes(file.type)) {
        alert('Please upload an image (JPG, PNG) or PDF file');
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleFileUpload = async () => {
    if (!selectedFile) return;

    setUploadingFile(true);
    const formData = new FormData();
    formData.append('receipt', selectedFile);
    if (currentConversationId) {
      formData.append('conversationId', currentConversationId);
    }

    try {
      const res = await api.post('/ai/upload-receipt', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (res.data.success) {
        // Add user message with file
        const userMessage = {
          role: 'user',
          content: `📎 Uploaded receipt: ${selectedFile.name}`,
          timestamp: new Date(),
          hasFile: true,
          fileName: selectedFile.name,
        };
        setMessages(prev => [...prev, userMessage]);

        // Add AI response
        const aiMessage = {
          role: 'assistant',
          content: res.data.message || 'Receipt uploaded successfully! I can see your order details. How can I help you with this order?',
          timestamp: new Date(),
          orderDetails: res.data.orderDetails,
        };
        setMessages(prev => [...prev, aiMessage]);

        // Update conversation ID if new
        if (res.data.conversationId && !currentConversationId) {
          setCurrentConversationId(res.data.conversationId);
          loadConversations();
        }

        setSelectedFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    } catch (error) {
      console.error('Error uploading receipt:', error);
      alert('Failed to upload receipt. Please try again.');
    } finally {
      setUploadingFile(false);
    }
  };

  const removeSelectedFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatTime = (date) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const formatRelativeTime = (date) => {
    if (!date) return '';
    const d = new Date(date);
    const now = new Date();
    const diff = now - d;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="chat-page">
      <div className="chat-container">
        {/* Sidebar */}
        <div className={`chat-sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
          <div className="sidebar-header">
            <button onClick={createNewConversation} className="new-chat-btn">
              + New Chat
            </button>
          </div>
          
          <div className="conversations-list">
            {conversations.map((conv) => (
              <div
                key={conv.id}
                className={`conversation-item ${currentConversationId === conv.id ? 'active' : ''}`}
                onClick={() => loadConversationMessages(conv.id)}
              >
                <div className="conversation-info">
                  <div className="conversation-title">{conv.title}</div>
                  <div className="conversation-time">{formatRelativeTime(conv.updatedAt)}</div>
                </div>
                <button
                  className="delete-conversation-btn"
                  onClick={(e) => deleteConversation(conv.id, e)}
                  title="Delete conversation"
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Main Chat Area */}
        <div className="chat-main">
          {/* Header */}
          <div className="chat-page-header">
            <button 
              className="sidebar-toggle-btn"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              {sidebarOpen ? '◀' : '▶'}
            </button>
            <div className="chat-page-header-info">
              <span className="chat-page-avatar">🤖</span>
              <div>
                <h1>AI Assistant</h1>
                <p>Online • Powered by Llama 3</p>
              </div>
            </div>
            <button 
              className="chat-close-btn"
              onClick={() => navigate(-1)}
              title="Close Chat"
            >
              ✕
            </button>
          </div>

          {/* Messages Area */}
          <div className="chat-messages-container">
            {messages.length === 0 && (
              <div className="chat-welcome-message">
                <h2>Hi! 👋 I'm your AI assistant</h2>
                <p>How can I help you today?</p>
                <div className="chat-features-list">
                  <div className="feature-item">
                    <span className="feature-icon">📦</span>
                    <span>Track your orders</span>
                  </div>
                  <div className="feature-item">
                    <span className="feature-icon">💡</span>
                    <span>Get product recommendations</span>
                  </div>
                  <div className="feature-item">
                    <span className="feature-icon">↩️</span>
                    <span>Return & refund queries</span>
                  </div>
                  <div className="feature-item">
                    <span className="feature-icon">💬</span>
                    <span>24/7 customer support</span>
                  </div>
                </div>
              </div>
            )}

            {messages.map((msg, index) => (
              <div
                key={index}
                className={`chat-message ${msg.role === 'user' ? 'user-message' : 'ai-message'}`}
              >
                <div className="message-wrapper">
                  {msg.role === 'assistant' && (
                    <div className="message-avatar">🤖</div>
                  )}
                  <div className="message-content">
                    <div className="message-text">
                      {msg.content}
                      {msg.escalate && (
                        <div className="escalation-badge">
                          ⚠️ Escalated to support team
                        </div>
                      )}
                    </div>
                    <div className="message-time">{formatTime(msg.timestamp)}</div>
                  </div>
                  {msg.role === 'user' && (
                    <div className="message-avatar">👤</div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="chat-message ai-message">
                <div className="message-wrapper">
                  <div className="message-avatar">🤖</div>
                  <div className="message-content">
                    <div className="typing-indicator">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="chat-input-container">
            {/* Selected File Preview */}
            {selectedFile && (
              <div className="selected-file-preview">
                <span>📎 {selectedFile.name}</span>
                <button onClick={removeSelectedFile} className="remove-file-btn">✕</button>
                <button 
                  onClick={handleFileUpload} 
                  disabled={uploadingFile}
                  className="upload-file-btn"
                >
                  {uploadingFile ? 'Uploading...' : 'Upload'}
                </button>
              </div>
            )}
            
            <div className="chat-input-wrapper">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept="image/jpeg,image/png,image/jpg,application/pdf"
                style={{ display: 'none' }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="chat-attach-btn"
                title="Upload receipt"
                disabled={loading || uploadingFile}
              >
                📎
              </button>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your message... (or upload receipt)"
                disabled={loading || uploadingFile}
                className="chat-input"
              />
              <button
                onClick={() => sendMessage()}
                disabled={loading || uploadingFile || !input.trim()}
                className="chat-send-btn"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}