import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

const AuthContext = createContext();

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const TOKEN_KEY = 'auth_token';
const REFRESH_TOKEN_KEY = 'auth_refresh_token';
const USER_KEY = 'auth_user';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem(USER_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);
  const refreshPromiseRef = useRef(null);

  const clearAuth = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
  }, []);

  // Attempt to refresh the access token using the stored refresh token.
  // Deduplicates concurrent calls so only one refresh request is in-flight at a time.
  const doRefresh = useCallback(async () => {
    if (refreshPromiseRef.current) return refreshPromiseRef.current;

    const storedRefreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (!storedRefreshToken) {
      clearAuth();
      return null;
    }

    refreshPromiseRef.current = fetch(`${BACKEND_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: storedRefreshToken }),
    })
      .then(async r => {
        if (!r.ok) {
          clearAuth();
          return null;
        }
        const { access_token, refresh_token } = await r.json();
        localStorage.setItem(TOKEN_KEY, access_token);
        localStorage.setItem(REFRESH_TOKEN_KEY, refresh_token);
        return access_token;
      })
      .catch(() => {
        clearAuth();
        return null;
      })
      .finally(() => {
        refreshPromiseRef.current = null;
      });

    return refreshPromiseRef.current;
  }, [clearAuth]);

  // Fetch with automatic token refresh on 401.
  const authFetch = useCallback(async (url, options = {}) => {
    const token = localStorage.getItem(TOKEN_KEY);
    const headers = { ...(options.headers || {}), Authorization: `Bearer ${token}` };
    let res = await fetch(url, { ...options, headers });

    if (res.status === 401) {
      const newToken = await doRefresh();
      if (!newToken) return res;
      const retryHeaders = { ...(options.headers || {}), Authorization: `Bearer ${newToken}` };
      res = await fetch(url, { ...options, headers: retryHeaders });
    }
    return res;
  }, [doRefresh]);

  // Verify token on mount; try refresh if access token is missing or invalid.
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);

    if (!token && !refreshToken) {
      setLoading(false);
      return;
    }

    const verifyOrRefresh = async () => {
      if (token) {
        try {
          const res = await fetch(`${BACKEND_URL}/api/auth/me`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const userData = await res.json();
            setUser(userData);
            localStorage.setItem(USER_KEY, JSON.stringify(userData));
            return;
          }
        } catch {
          // fall through to refresh
        }
      }

      // Access token missing or invalid — try refreshing
      const newToken = await doRefresh();
      if (newToken) {
        try {
          const res = await fetch(`${BACKEND_URL}/api/auth/me`, {
            headers: { Authorization: `Bearer ${newToken}` },
          });
          if (res.ok) {
            const userData = await res.json();
            setUser(userData);
            localStorage.setItem(USER_KEY, JSON.stringify(userData));
            return;
          }
        } catch {
          // fall through
        }
      }

      clearAuth();
    };

    verifyOrRefresh().finally(() => setLoading(false));
  }, [doRefresh, clearAuth]);

  const login = useCallback(async (email, password) => {
    const res = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Login failed');
    }
    const { access_token, refresh_token } = await res.json();
    localStorage.setItem(TOKEN_KEY, access_token);
    localStorage.setItem(REFRESH_TOKEN_KEY, refresh_token);
    const meRes = await fetch(`${BACKEND_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const userData = await meRes.json();
    localStorage.setItem(USER_KEY, JSON.stringify(userData));
    setUser(userData);
    return userData;
  }, []);

  const signup = useCallback(async (name, email, password) => {
    const res = await fetch(`${BACKEND_URL}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Signup failed');
    }
    const { access_token, refresh_token } = await res.json();
    localStorage.setItem(TOKEN_KEY, access_token);
    localStorage.setItem(REFRESH_TOKEN_KEY, refresh_token);
    const meRes = await fetch(`${BACKEND_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const userData = await meRes.json();
    localStorage.setItem(USER_KEY, JSON.stringify(userData));
    setUser(userData);
    return userData;
  }, []);

  const logout = useCallback(() => {
    clearAuth();
  }, [clearAuth]);

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, authFetch }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
