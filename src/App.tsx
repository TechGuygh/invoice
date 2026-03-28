/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { LayoutDashboard, FileText, Users, BarChart3, Settings as SettingsIcon, Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Invoices from './components/Invoices';
import InvoiceCreation from './components/InvoiceCreation';
import Settings from './components/Settings';
import { AuthProvider, useAuth } from './context/AuthContext';

import Login from './components/Login';

const queryClient = new QueryClient();

function MainLayout() {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const activeTab = location.pathname.substring(1) || 'dashboard';

  const [settings, setSettings] = useState({
    themeColor: 'bg-gradient-to-r from-purple-500 to-fuchsia-600',
    logo: null,
    showQtyPrice: true,
    showDiscount: false,
    template: 'modern',
  });

  const navItems = [
    { id: 'invoices', label: 'Invoices', icon: FileText, path: '/' },
    { id: 'settings', label: 'Settings', icon: SettingsIcon, path: '/settings' },
  ];

  return (
    <div className="flex h-screen bg-neutral-50 overflow-hidden font-sans text-neutral-900">
      {/* Mobile Drawer Overlay */}
      <AnimatePresence>
        {isDrawerOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsDrawerOpen(false)}
            className="fixed inset-0 bg-neutral-900/50 z-40 md:hidden backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      {/* Sidebar Drawer */}
      <motion.aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-neutral-200 flex flex-col transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${
          isDrawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-16 md:h-20 flex items-center justify-between px-6 border-b border-neutral-100 shrink-0">
          <div className="flex items-center gap-2">
            <svg viewBox="0 0 50 40" className="h-7 w-auto" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M 12 32 L 28 16" stroke="#526DFF" strokeWidth="8" strokeLinecap="round" />
              <path d="M 24 32 L 40 16" stroke="#526DFF" strokeWidth="8" strokeLinecap="round" />
              <circle cx="40" cy="32" r="4" fill="#526DFF" />
            </svg>
            <span className="text-2xl font-bold text-neutral-900 tracking-tight">mods</span>
          </div>
          <button onClick={() => setIsDrawerOpen(false)} className="md:hidden p-2 -mr-2 text-neutral-500 hover:bg-neutral-100 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 space-y-2 overflow-y-auto flex-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || (item.path === '/' && location.pathname === '/dashboard');
            return (
              <button
                key={item.id}
                onClick={() => {
                  navigate(item.path);
                  setIsDrawerOpen(false);
                }}
                className={`w-full flex items-center px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300 ${
                  isActive
                    ? 'bg-purple-100 text-purple-700 shadow-sm'
                    : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50'
                }`}
              >
                <item.icon className="w-5 h-5 mr-3" />
                {item.label}
              </button>
            );
          })}
        </div>
        <div className="p-4 border-t border-neutral-100 shrink-0">
          <div className="flex items-center gap-3 px-4 py-3 mb-2">
            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
              {user?.name?.charAt(0) || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-neutral-900 truncate">{user?.name}</p>
              <p className="text-xs text-neutral-500 truncate capitalize">{user?.role}</p>
            </div>
          </div>
          <button
            onClick={async () => {
              await logout();
              queryClient.clear();
              window.location.href = '/login';
            }}
            className="w-full flex items-center px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-xl transition-colors"
          >
            <svg className="w-5 h-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Logout
          </button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Mobile Header */}
        <header className="md:hidden bg-white border-b border-neutral-200 h-16 flex items-center px-4 justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsDrawerOpen(true)} className="p-2 -ml-2 text-neutral-600 hover:bg-neutral-100 rounded-full">
              <Menu className="w-6 h-6" />
            </button>
            <div className="flex items-center gap-2">
              <svg viewBox="0 0 50 40" className="h-6 w-auto" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M 12 32 L 28 16" stroke="#526DFF" strokeWidth="8" strokeLinecap="round" />
                <path d="M 24 32 L 40 16" stroke="#526DFF" strokeWidth="8" strokeLinecap="round" />
                <circle cx="40" cy="32" r="4" fill="#526DFF" />
              </svg>
              <span className="text-xl font-bold text-neutral-900 tracking-tight">mods</span>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-neutral-50">
          <div className="max-w-7xl mx-auto">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            >
              <Routes>
                <Route path="/" element={<Invoices settings={settings} />} />
                <Route path="/invoices/new" element={<InvoiceCreation settings={settings} />} />
                <Route path="/invoices/edit/:id" element={<InvoiceCreation settings={settings} />} />
                <Route path="/settings" element={<Settings settings={settings} setSettings={setSettings} />} />
              </Routes>
            </motion.div>
          </div>
        </main>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  
  if (loading) {
    return <div className="h-screen flex items-center justify-center bg-neutral-50"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>;
  }
  
  if (!user) {
    // If no user, clear session data and redirect to login
    logout();
    queryClient.clear();
    window.location.href = '/login?error=Session expired. Please log in again.';
    return <div className="h-screen flex items-center justify-center bg-neutral-50 text-neutral-600">Session expired. Redirecting to login...</div>;
  }
  
  return <>{children}</>;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/*" element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            } />
          </Routes>
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  );
}
