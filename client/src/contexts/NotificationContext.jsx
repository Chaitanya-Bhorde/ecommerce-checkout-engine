import { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from './AuthContext';

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  // Fetch notifications
  const fetchNotifications = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const res = await api.get('/notifications');
      if (res.data.success) {
        setNotifications(res.data.notifications);
        setUnreadCount(res.data.unreadCount);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch unread count
  const fetchUnreadCount = async () => {
    if (!user) return;
    
    try {
      const res = await api.get('/notifications/unread-count');
      if (res.data.success) {
        setUnreadCount(res.data.unreadCount);
      }
    } catch (error) {
      console.error('Error fetching unread count:', error);
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

  // Poll for new notifications every 30 seconds
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(() => {
      fetchUnreadCount();
    }, 30000);

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