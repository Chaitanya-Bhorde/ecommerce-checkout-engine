import { useState, useRef, useEffect } from 'react';
import io from 'socket.io-client';
import './ChatWidget.css';

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [socket, setSocket] = useState(null);
  const [readReceipts, setReadReceipts] = useState({});
  const [soundEnabled, setSoundEnabled] = useState(true);
  const messagesEndRef = useRef(null);
  const userId = localStorage.getItem('userId') || 'guest';
  const token = localStorage.getItem('token');

  // Initialize Socket.io connection
  useEffect(() => {
    if (isOpen && token) {
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
        setIsTyping(false);
        
        // Play notification sound
        if (soundEnabled) {
          playNotificationSound();
        }
      });

      newSocket.on('typing', (data) => {
        setIsTyping(data.isTyping);
      });

      newSocket.on('suggestions', (data) => {
        setSuggestions(data.suggestions || []);
      });

      newSocket.on('messageRead', (data) => {
        setReadReceipts(prev => ({ ...prev, [data.messageId]: true }));
      });

      newSocket.on('error', (data) => {
        console.error('Socket error:', data);
        setLoading(false);
        setIsTyping(false);
      });

      setSocket(newSocket);

      // Load chat history on mount
      loadChatHistory();

      return () => {
        newSocket.close();
      };
    }
  }, [isOpen, token]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const loadChatHistory = async () => {
    try {
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
    if (!text.trim() || loading || !socket) return;

    const messageId = Date.now();
    const userMessage = { 
      id: messageId,
      role: 'user', 
      content: text,
      timestamp: new Date(),
      status: 'sent',
    };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    setIsTyping(true);

    try {
      socket.emit('sendMessage', { message: text, messageId });
      
      // Simulate read receipt after 1 second
      setTimeout(() => {
        setReadReceipts(prev => ({ ...prev, [messageId]: true }));
      }, 1000);
    } catch (error) {
      console.error('Chat error:', error);
      setLoading(false);
      setIsTyping(false);
    }
  };

  const clearChat = async () => {
    try {
      await fetch('/api/ai/chat/clear', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userId }),
      });
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

  const formatTime = (date) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  // Play notification sound
  const playNotificationSound = () => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    } catch (error) {
      console.error('Error playing sound:', error);
    }
  };

  const toggleSound = () => {
    setSoundEnabled(!soundEnabled);
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
              onClick={toggleSound}
              className="chat-sound-btn"
              title={soundEnabled ? 'Mute notifications' : 'Unmute notifications'}
            >
              {soundEnabled ? '🔊' : '🔇'}
            </button>
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
                    <span className="message-time">{formatTime(msg.timestamp)}</span>
                    {msg.role === 'user' && (
                      <span className="read-receipt">
                        {readReceipts[msg.id] ? '✓✓' : '✓'}
                      </span>
                    )}
                  </div>
                  {msg.role === 'user' && <span className="message-avatar">👤</span>}
                </div>
              </div>
            ))}

            {isTyping && (
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