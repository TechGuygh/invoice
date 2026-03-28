import { createContext, useContext, useState, useEffect } from 'react';

type User = {
  id: string;
  email: string;
  name: string;
  role: string;
};

type AuthContextType = {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  loading: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Only auto-login if we're not on the login page and don't have a token
    if (window.location.pathname === '/login') {
      setLoading(false);
      return;
    }

    fetch('/api/auth/auto-login', { method: 'POST' })
      .then(res => res.json())
      .then(data => {
        if (data.token && data.user) {
          setToken(data.token);
          setUser(data.user);
        } else {
          // If auto-login fails, clear state
          setToken(null);
          setUser(null);
        }
      })
      .catch((err) => {
        console.error(err);
        setToken(null);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = (newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
  };

  const logout = async () => {
    try {
      if (token) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // 1. Clear state
      setToken(null);
      setUser(null);
      
      // 2. Clear local storage and session storage
      localStorage.clear();
      sessionStorage.clear();
      
      // 3. Clear any cookies (if we had any, we'd clear them here)
      document.cookie.split(";").forEach((c) => {
        document.cookie = c
          .replace(/^ +/, "")
          .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
      });
      
      // 4. Redirect is handled by ProtectedRoute or the component calling logout
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
