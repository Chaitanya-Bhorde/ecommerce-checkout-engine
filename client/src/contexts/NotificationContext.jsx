import { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from './AuthContext';

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  // Fetch notifications with retry logic
  const fetchNotifications = async (retries = 3, delay = 2000) => {
    if (!user) return;
    
    setLoading(true);
    try {
      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          const res = await api.get('/notifications');
          if (res.data.success) {
            setNotifications(res.data.notifications);
            setUnreadCount(res.data.unreadCount);
          }
          return; // Success - exit retry loop
        } catch (error) {
          if (error.code === 'ERR_NETWORK' || error.message?.includes('ECONNREFUSED')) {
            if (attempt < retries) {
              console.warn(`Notifications fetch attempt ${attempt}/${retries} failed (server not ready), retrying in ${delay}ms...`);
              await new Promise(resolve => setTimeout(resolve, delay));
              delay *= 2; // Exponential backoff
            } else {
              console.error('Error fetching notifications after all retries:', error);
            }
          } else {
            console.error('Error fetching notifications:', error);
            return; // Non-connection error, don't retry
          }
        }
      }
    } finally {
      setLoading(false);
    }
  };

  // Fetch unread count with retry logic
  const fetchUnreadCount = async (retries = 3, delay = 2000) => {
    if (!user) return;
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const res = await api.get('/notifications/unread-count');
        if (res.data.success) {
          setUnreadCount(res.data.unreadCount);
        }
        return; // Success - exit retry loop
      } catch (error) {
        if (error.code === 'ERR_NETWORK' || error.message?.includes('ECONNREFUSED')) {
          if (attempt < retries) {
            console.warn(`Notification fetch attempt ${attempt}/${retries} failed (server not ready), retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 2; // Exponential backoff
          } else {
            console.error('Error fetching unread count after all retries:', error);
          }
        } else {
          console.error('Error fetching unread count:', error);
          return; // Non-connection error, don't retry
        }
      }
    }
  };

  // Mark notification as read
  const markAsRead = async (notificationId) => {
    try {
      const res = await api.put(`/notifications/${notificationId}/read`);
      if (res.data.success) {
        setNotifications(prev =>
          prev.map(n => n._id === notificationId ? { ...n, read: true } : n)
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    try {
      const res = await api.put('/notifications/read-all');
      if (res.data.success) {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  // Delete notification
  const deleteNotification = async (notificationId) => {
    try {
      const res = await api.delete(`/notifications/${notificationId}`);
      if (res.data.success) {
        setNotifications(prev => {
          const notification = prev.find(n => n._id === notificationId);
          const wasUnread = notification && !notification.read;
          const newNotifications = prev.filter(n => n._id !== notificationId);
          if (wasUnread) {
            setUnreadCount(prevCount => Math.max(0, prevCount - 1));
          }
          return newNotifications;
        });
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  // Load notifications when user changes
  useEffect(() => {
    if (user) {
      fetchNotifications();
    } else {
      setNotifications([]);
      setUnreadCount(0);
    }
  }, [user]);

  // Poll for new notifications every 60 seconds (increased to avoid rate limits)
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(() => {
      fetchUnreadCount();
    }, 60000); // Changed from 30000 to 60000

    return () => clearInterval(interval);
  }, [user]);

  const value = {
    notifications,
    unreadCount,
    loading,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
};