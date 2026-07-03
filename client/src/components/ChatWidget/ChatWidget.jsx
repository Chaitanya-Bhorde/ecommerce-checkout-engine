import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import './ChatWidget.css';

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const messagesEndRef = useRef(null);
  const userId = localStorage.getItem('userId') || 'guest';

  // Load chat history on mount
  useEffect(() => {
    if (isOpen) {
      loadChatHistory();
      loadSuggestions();
    }
  }, [isOpen]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadChatHistory = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`/api/ai/chat/history/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMessages(res.data.history || []);
    } catch (error) {
      console.error('Error loading chat history:', error);
    }
  };

  const loadSuggestions = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`/api/ai/chat/suggestions/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSuggestions(res.data.suggestions || []);
    } catch (error) {
      console.error('Error loading suggestions:', error);
    }
  };

  const sendMessage = async (text = input) => {
    if (!text.trim() || loading) return;

    const userMessage = { role: 'user', content: text };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(
        '/api/ai/chat',
        { message: text, userId },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const aiMessage = { role: 'assistant', content: res.data.response };
      setMessages(prev => [...prev, aiMessage]);
      
      // Update suggestions based on AI response
      setSuggestions(res.data.suggestions || []);
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage = { 
        role: 'assistant', 
        content: "I'm sorry, I'm having trouble right now. Please try again or contact support." 
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.post('/api/ai/chat/clear', 
        { userId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMessages([]);
      setSuggestions([
        'Track my order',
        'Product recommendations',
        'Return policy',
        'Talk to human agent',
      ]);
    } catch (error) {
      console.error('Error clearing chat:', error);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="chat-widget-container">
      {/* Chat Toggle Button */}
      {!isOpen && (
        <button 
          className="chat-toggle-btn"
          onClick={() => setIsOpen(true)}
          title="Chat with AI"
        >
          💬
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="chat-window">
          {/* Header - Always Visible */}
          <div className="chat-header">
            <div className="chat-header-info">
              <span className="chat-avatar">🤖</span>
              <div>
                <h3>AI Assistant</h3>
                <span className="chat-status">Online</span>
              </div>
            </div>
            <div className="chat-header-actions">
              <button 
                onClick={clearChat}
                className="chat-clear-btn"
                title="Clear chat"
              >
                🗑️
              </button>
              <button 
                onClick={() => setIsOpen(false)}
                className="chat-close-btn"
                title="Close chat"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Messages Area */}
          <div className="chat-messages">
            {messages.length === 0 && (
              <div className="chat-welcome">
                <h4>Hi! 👋 I'm your AI assistant</h4>
                <p>How can I help you today?</p>
                <div className="chat-features">
                  <span>📦 Order tracking</span>
                  <span>💡 Product recommendations</span>
                  <span>↩️ Return/refund queries</span>
                </div>
              </div>
            )}

            {messages.map((msg, index) => (
              <div
                key={index}
                className={`chat-message ${msg.role === 'user' ? 'user-message' : 'ai-message'}`}
              >
                <div className="message-content">
                  {msg.role === 'assistant' && <span className="message-avatar">🤖</span>}
                  <div className="message-text">
                    {msg.content}
                  </div>
                  {msg.role === 'user' && <span className="message-avatar">👤</span>}
                </div>
              </div>
            ))}

            {loading && (
              <div className="chat-message ai-message">
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

          {/* Suggestions - Only show when not loading and has suggestions */}
          {!loading && suggestions.length > 0 && (
            <div className="chat-suggestions">
              {suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => sendMessage(suggestion)}
                  className="suggestion-btn"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}

          {/* Input Area - Always Visible */}
          <div className="chat-input-area">
            <div className="chat-input-container">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your message..."
                disabled={loading}
              />
              <button
                onClick={() => sendMessage()}
                disabled={loading || !input.trim()}
                className="chat-send-btn"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}