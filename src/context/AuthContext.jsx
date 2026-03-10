import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'react-toastify';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const inactivityTimerRef = useRef(null);
  const lastActivityRef = useRef(Date.now());

  // Get inactivity timeout from env (in minutes, default 10)
  const INACTIVITY_TIMEOUT = (import.meta.env.VITE_INACTIVITY_TIMEOUT || 10) * 60 * 1000; // Convert to milliseconds

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('di_token');
    localStorage.removeItem('di_user');
    
    // Clear inactivity timer
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
  }, []);

  const resetInactivityTimer = useCallback(() => {
    // Only reset if user is logged in
    if (!token) return;

    lastActivityRef.current = Date.now();

    // Clear existing timer
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }

    // Set new timer
    inactivityTimerRef.current = setTimeout(() => {
      console.log('[Auth] User inactive for', INACTIVITY_TIMEOUT / 60000, 'minutes. Logging out...');
      toast.warning(`You've been logged out due to ${INACTIVITY_TIMEOUT / 60000} minutes of inactivity.`, {
        autoClose: 5000
      });
      logout();
      
      // Small delay before redirect to show toast
      setTimeout(() => {
        window.location.href = '/login';
      }, 500);
    }, INACTIVITY_TIMEOUT);
  }, [token, INACTIVITY_TIMEOUT, logout]);

  // Track user activity
  useEffect(() => {
    if (!token) return;

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];

    const handleActivity = () => {
      resetInactivityTimer();
    };

    // Add event listeners for user activity
    events.forEach((event) => {
      document.addEventListener(event, handleActivity);
    });

    // Initialize timer
    resetInactivityTimer();

    // Cleanup
    return () => {
      events.forEach((event) => {
        document.removeEventListener(event, handleActivity);
      });
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
    };
  }, [token, resetInactivityTimer]);

  useEffect(() => {
    const storedToken = localStorage.getItem('di_token');
    const storedUser = localStorage.getItem('di_user');
    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  const login = (userData, jwtToken) => {
    setUser(userData);
    setToken(jwtToken);
    localStorage.setItem('di_token', jwtToken);
    localStorage.setItem('di_user', JSON.stringify(userData));
    resetInactivityTimer();
  };

  const updateUser = (updatedUser) => {
    setUser(updatedUser);
    localStorage.setItem('di_user', JSON.stringify(updatedUser));
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

export default AuthContext;
