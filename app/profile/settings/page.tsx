'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import { Moon, Sun, Trash2, Shield, ChevronRight, Loader2, AlertTriangle } from 'lucide-react';

export default function SettingsPage() {
  const { user, profile, signOut, loading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push('/auth/login');
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="min-h-screen dark:bg-[#0a0a0f] bg-[#f0f0f8] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
      </div>
    );
  }

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="glass-card rounded-2xl overflow-hidden mb-4">
      <div className="px-4 py-2.5 dark:border-white/5 border-gray-100 border-b">
        <span className="dark:text-gray-400 text-gray-500 text-xs font-medium uppercase tracking-wider">{title}</span>
      </div>
      <div className="divide-y dark:divide-white/5 divide-gray-100">
        {children}
      </div>
    </div>
  );

  const Row = ({
    icon: Icon,
    label,
    sub,
    right,
    onClick,
    danger = false,
  }: {
    icon: any;
    label: string;
    sub?: string;
    right?: React.ReactNode;
    onClick?: () => void;
    danger?: boolean;
  }) => (
    <button
      className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-all ${
        onClick ? 'dark:hover:bg-white/3 hover:bg-gray-50' : ''
      } ${danger ? 'text-red-400' : ''}`}
      onClick={onClick}
    >
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${danger ? 'bg-red-500/10' : 'dark:bg-white/5 bg-gray-100'}`}>
        <Icon className={`w-4 h-4 ${danger ? 'text-red-400' : 'dark:text-gray-400 text-gray-500'}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${danger ? 'text-red-400' : 'dark:text-white text-gray-900'}`}>{label}</p>
        {sub && <p className="dark:text-gray-400 text-gray-500 text-xs">{sub}</p>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
      {onClick && !right && <ChevronRight className="w-4 h-4 dark:text-gray-500 text-gray-400 shrink-0" />}
    </button>
  );

  return (
    <div className="min-h-screen dark:bg-[#0a0a0f] bg-[#f0f0f8] bg-grid">
      <Navbar />
      <div className="max-w-lg mx-auto px-4 pt-20 pb-24">
        <div className="mb-6 pt-6">
          <h1 className="font-display font-bold text-3xl dark:text-white text-gray-900">Settings</h1>
        </div>

        <Section title="Appearance">
          <Row
            icon={theme === 'dark' ? Moon : Sun}
            label="Theme"
            sub={theme === 'dark' ? 'Dark mode active' : 'Light mode active'}
            right={
              <button
                onClick={toggleTheme}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  theme === 'dark' ? 'bg-violet-600' : 'bg-gray-300'
                }`}
              >
                <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                  theme === 'dark' ? 'translate-x-5' : 'translate-x-0.5'
                }`} />
              </button>
            }
          />
        </Section>

        <Section title="Account">
          <Row
            icon={Shield}
            label="Email"
            sub={user.email || 'No email'}
          />
          <Row
            icon={Shield}
            label="Change Password"
            sub="Send reset email"
            onClick={async () => {
              if (user.email) {
                await supabase.auth.resetPasswordForEmail(user.email);
                alert('Password reset email sent!');
              }
            }}
          />
        </Section>

        <Section title="Danger Zone">
          {!deleteConfirm ? (
            <Row
              icon={Trash2}
              label="Delete Account"
              sub="Permanently delete your account and data"
              danger
              onClick={() => setDeleteConfirm(true)}
            />
          ) : (
            <div className="px-4 py-4 space-y-3">
              <div className="flex items-center gap-2 text-red-400 text-sm">
                <AlertTriangle className="w-4 h-4" />
                <span className="font-medium">This action is permanent and cannot be undone.</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setDeleteConfirm(false)}
                  className="flex-1 py-2 rounded-xl dark:bg-white/5 bg-gray-100 dark:text-gray-300 text-gray-600 text-sm font-medium transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    // In production: call a server action to delete user
                    await signOut();
                    router.push('/');
                  }}
                  className="flex-1 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition-all"
                >
                  Delete Account
                </button>
              </div>
            </div>
          )}
        </Section>

        <div className="text-center">
          <button
            onClick={async () => { await signOut(); router.push('/'); }}
            className="px-6 py-2.5 rounded-xl dark:bg-white/5 bg-gray-100 dark:text-gray-400 text-gray-600 font-medium text-sm transition-all dark:hover:bg-white/10 hover:bg-gray-200"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
