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
    // Auto-login for now since login/signup are removed
    fetch('/api/auth/auto-login', { method: 'POST' })
      .then(res => res.json())
      .then(data => {
        if (data.token && data.user) {
          setToken(data.token);
          setUser(data.user);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const login = (newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
  };

  const logout = () => {
    // No-op since we removed login
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
