import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { apiRequest, setAuthToken } from '../services/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshNotifications = useCallback(async () => {
    try {
      const data = await apiRequest('/api/notifications');
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch {
      // Ignore when logged out
    }
  }, []);

  useEffect(() => {
    if (user) {
      refreshNotifications();
    } else {
      setNotifications([]);
      setUnreadCount(0);
    }
  }, [user, refreshNotifications]);

  const applyAuthSession = useCallback((data) => {
    setAuthToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const login = useCallback(
    async (email, password) => {
      const data = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: { email, password },
      });
      return applyAuthSession(data);
    },
    [applyAuthSession]
  );

  const register = useCallback(
    async (payload) => {
      const data = await apiRequest('/api/auth/register', {
        method: 'POST',
        body: payload,
      });
      return { user: applyAuthSession(data), note: data.note };
    },
    [applyAuthSession]
  );

  const demoLogin = useCallback(
    async (role) => {
      const data = await apiRequest('/api/auth/demo-login', {
        method: 'POST',
        body: { role },
      });
      return applyAuthSession(data);
    },
    [applyAuthSession]
  );

  const logout = useCallback(() => {
    setAuthToken(null);
    setUser(null);
    setNotifications([]);
    setUnreadCount(0);
  }, []);

  const markNotificationRead = useCallback(async (id) => {
    await apiRequest(`/api/notifications/${id}/read`, { method: 'PATCH' });
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: 1 } : n)));
    setUnreadCount((prev) => Math.max(0, prev - 1));
  }, []);

  const markAllRead = useCallback(async () => {
    await apiRequest('/api/notifications/read-all', { method: 'POST' });
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
    setUnreadCount(0);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        notifications,
        unreadCount,
        login,
        register,
        demoLogin,
        logout,
        refreshNotifications,
        markNotificationRead,
        markAllRead,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
