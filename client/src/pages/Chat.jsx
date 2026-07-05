import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import io from 'socket.io-client';
import './Chat.css';

export default function Chat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [socket, setSocket] = useState(null);
  const messagesEndRef = useRef(null);
  const { user } = useAuth();
  const token = localStorage.getItem('token');

  // Initialize Socket.io connection
  useEffect(() => {
    if (token) {
      const newSocket = io('http://localhost:5000', {
        auth: { token },
        transports: ['websocket', 'polling'],
      });

      newSocket.on('connect', () => {
        console.log('Socket connected');
      });

      newSocket.on('receiveMessage', (data) => {
        setMessages(prev => [...prev, data]);
        setLoading(false);
      });

      newSocket.on('typing', (data) => {
        // Handle typing indicator
      });

      setSocket(newSocket);

      // Load chat history
      loadChatHistory();

      return () => {
        newSocket.close();
      };
    }
  }, [token]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadChatHistory = async () => {
    try {
      const userId = localStorage.getItem('userId') || 'guest';
      const res = await fetch(`/api/ai/chat/history/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setMessages(data.history || []);
      }
    } catch (error) {
      console.error('Error loading chat history:', error);
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
      // Use HTTP API (more reliable)
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: text }),
      });

      const data = await response.json();

      if (data.success) {
        const aiMessage = {
          role: 'assistant',
          content: data.response,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, aiMessage]);
      } else {
        console.error('API error:', data);
      }

      setLoading(false);
    } catch (error) {
      console.error('Chat error:', error);
      setLoading(false);
    }
  };

  const clearChat = async () => {
    try {
      const userId = localStorage.getItem('userId') || 'guest';
      await fetch('/api/ai/chat/clear', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userId }),
      });
      setMessages([]);
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

  const formatTime = (date) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="chat-page">
      <div className="chat-container">
        {/* Header */}
        <div className="chat-page-header">
          <div className="chat-page-header-info">
            <span className="chat-page-avatar">🤖</span>
            <div>
              <h1>AI Assistant</h1>
              <p>Online • Powered by Llama 3</p>
            </div>
          </div>
          <button onClick={clearChat} className="chat-clear-btn">
            Clear Chat
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
                  <div className="message-text">{msg.content}</div>
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
          <div className="chat-input-wrapper">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              disabled={loading}
              className="chat-input"
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
    </div>
  );
}