import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { ToastProvider } from './hooks/useToast';
import AppLayout from './layouts/AppLayout';
import LoginPage from './pages/Auth/LoginPage';
import SignupPage from './pages/Auth/SignupPage';
import DashboardPage from './pages/Dashboard/DashboardPage';
import ApplicationsPage from './pages/Applications/ApplicationsPage';
import JobFeedPage from './pages/JobFeed/JobFeedPage';
import WalkinsPage from './pages/Walkins/WalkinsPage';
import ResumesPage from './pages/Resumes/ResumesPage';
import AnalyticsPage from './pages/Analytics/AnalyticsPage';
import FriendsPage from './pages/Friends/FriendsPage';
import SettingsPage from './pages/Settings/SettingsPage';

import { isConfigured } from './lib/supabase';
import { AlertCircle, ExternalLink } from 'lucide-react';

function SetupBanner() {
  if (isConfigured) return null;
  return (
    <div className="bg-amber-950/80 border-b border-amber-600/40 px-4 py-3 text-amber-200 text-sm flex items-center justify-between gap-3 sticky top-0 z-50 backdrop-blur">
      <div className="flex items-center gap-2">
        <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0" />
        <span>
          <strong>Supabase Not Connected:</strong> Please update your <code className="bg-amber-900/60 px-1.5 py-0.5 rounded text-amber-300 font-mono text-xs">.env</code> file with your real Supabase URL & Anon Key, then restart the dev server.
        </span>
      </div>
      <a
        href="https://supabase.com/dashboard"
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-1 text-xs font-semibold bg-amber-600/30 hover:bg-amber-600/50 px-2.5 py-1 rounded-md text-amber-100 whitespace-nowrap transition-colors"
      >
        <span>Supabase Dashboard</span>
        <ExternalLink className="w-3.5 h-3.5" />
      </a>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
      <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  return <AppLayout>{children}</AppLayout>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
      <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (user) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <SetupBanner />
          <Routes>
            <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
            <Route path="/signup" element={<PublicRoute><SignupPage /></PublicRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
            <Route path="/applications" element={<ProtectedRoute><ApplicationsPage /></ProtectedRoute>} />
            <Route path="/job-feed" element={<ProtectedRoute><JobFeedPage /></ProtectedRoute>} />
            <Route path="/walkins" element={<ProtectedRoute><WalkinsPage /></ProtectedRoute>} />
            <Route path="/resumes" element={<ProtectedRoute><ResumesPage /></ProtectedRoute>} />
            <Route path="/analytics" element={<ProtectedRoute><AnalyticsPage /></ProtectedRoute>} />
            <Route path="/friends" element={<ProtectedRoute><FriendsPage /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
