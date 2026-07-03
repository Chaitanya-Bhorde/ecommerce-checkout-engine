import { useState, useEffect, useRef } from 'react';
import { api } from '../../services/api';
import './ChatWidget.css';

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [userId] = useState(() => localStorage.getItem('userId') || 'guest');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Load chat history on mount
    loadChatHistory();
  }, []);

  const loadChatHistory = async () => {
    try {
      const res = await api.get(`/ai/chat/history/${userId}`);
      if (res.data && res.data.length > 0) {
        setMessages(res.data);
      } else {
        // Welcome message
        setMessages([
          {
            role: 'assistant',
            content: 'Hi! 👋 I\'m your AI assistant. How can I help you today?\n\nI can help you with:\n- Order tracking\n- Product recommendations\n- Return/refund queries\n- General questions',
            timestamp: new Date(),
          },
        ]);
      }
    } catch (err) {
      console.error('Failed to load chat history:', err);
      // Set welcome message on error
      setMessages([
        {
          role: 'assistant',
          content: 'Hi! 👋 I\'m your AI assistant. How can I help you today?\n\nI can help you with:\n- Order tracking\n- Product recommendations\n- Return/refund queries\n- General questions',
          timestamp: new Date(),
        },
      ]);
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim()) return;

    const userMessage = {
      role: 'user',
      content: inputMessage,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsTyping(true);

    try {
      const res = await api.post('/ai/chat', {
        message: inputMessage,
        userId: userId,
      });

      const aiMessage = {
        role: 'assistant',
        content: res.data.response,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (err) {
      console.error('Chat error:', err);
      const errorMessage = {
        role: 'assistant',
        content: 'Sorry, I\'m having trouble right now. Please try again or contact support.',
        timestamp: new Date(),
        isError: true,
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = async () => {
    try {
      await api.post('/ai/chat/clear', { userId });
      setMessages([
        {
          role: 'assistant',
          content: 'Chat cleared! How can I help you?',
          timestamp: new Date(),
        },
      ]);
    } catch (err) {
      console.error('Failed to clear chat:', err);
    }
  };

  return (
    <div className="chat-widget">
      {/* Chat Button */}
      {!isOpen && (
        <button className="chat-button" onClick={() => setIsOpen(true)}>
          💬 Chat with AI
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="chat-window">
          {/* Header */}
          <div className="chat-header">
            <div className="chat-title">
              <span className="chat-icon">🤖</span>
              <div>
                <h3>AI Assistant</h3>
                <span className="chat-status">Online</span>
              </div>
            </div>
            <div className="chat-actions">
              <button onClick={clearChat} className="chat-action-btn" title="Clear chat">
                🗑️
              </button>
              <button onClick={() => setIsOpen(false)} className="chat-action-btn" title="Close">
                ✕
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="chat-messages">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`chat-message ${msg.role === 'user' ? 'user-message' : 'assistant-message'} ${msg.isError ? 'error-message' : ''}`}
              >
                <div className="message-content">
                  {msg.role === 'assistant' && <span className="message-avatar">🤖</span>}
                  <div className="message-text">
                    {msg.content.split('\n').map((line, i) => (
                      <p key={i}>{line}</p>
                    ))}
                  </div>
                  {msg.role === 'user' && <span className="message-avatar">👤</span>}
                </div>
                <span className="message-time">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
            {isTyping && (
              <div className="chat-message assistant-message">
                <div className="message-content">
                  <span className="message-avatar">🤖</span>
                  <div className="message-text typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Replies */}
          <div className="chat-quick-replies">
            <button onClick={() => setInputMessage('Track my order')}>📦 Track Order</button>
            <button onClick={() => setInputMessage('Show me product recommendations')}>🎁 Recommendations</button>
            <button onClick={() => setInputMessage('What is your return policy?')}>↩️ Return Policy</button>
          </div>

          {/* Input */}
          <div className="chat-input-container">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              className="chat-input"
            />
            <button onClick={sendMessage} className="chat-send-btn" disabled={!inputMessage.trim()}>
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
}