'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import { Zap, Brain, Trophy, TrendingUp, Shield, Smartphone } from 'lucide-react';

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen dark:bg-[#0a0a0f] bg-[#f0f0f8] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
          <p className="dark:text-gray-400 text-gray-500 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (user) return null;

  return (
    <div className="min-h-screen dark:bg-[#0a0a0f] bg-[#f0f0f8] bg-grid overflow-hidden">
      {/* Ambient blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-violet-900/20 dark:bg-violet-900/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-cyan-900/15 dark:bg-cyan-900/15 blur-[100px] rounded-full" />
      </div>

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-5 max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-violet-800 flex items-center justify-center">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <span className="font-display font-bold text-lg dark:text-white text-gray-900">
            Quiz<span className="text-violet-400">Master</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/auth/login"
            className="px-4 py-2 rounded-lg dark:text-gray-300 text-gray-600 dark:hover:text-white hover:text-gray-900 font-medium text-sm transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/auth/signup"
            className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-medium text-sm transition-all hover:shadow-lg hover:shadow-violet-500/25"
          >
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <div className="relative z-10 flex flex-col items-center text-center px-6 pt-20 pb-16 max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full dark:bg-violet-900/30 bg-violet-100 dark:border-violet-800/50 border-violet-200 border text-violet-400 text-xs font-medium mb-8">
          <Zap className="w-3.5 h-3.5" />
          Gamified Learning · Daily Streaks · XP System
        </div>

        <h1 className="font-display font-bold text-5xl sm:text-7xl dark:text-white text-gray-900 leading-tight mb-6">
          Learn smarter.
          <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-cyan-400">
            Level up faster.
          </span>
        </h1>

        <p className="dark:text-gray-400 text-gray-500 text-lg max-w-xl mb-10 leading-relaxed">
          Upload your own questions, track your daily practice with a heatmap, 
          earn XP, climb levels, and unlock badges — all in one powerful quiz app.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
          <Link
            href="/auth/signup"
            className="flex-1 px-6 py-3.5 rounded-xl bg-gradient-to-r from-violet-700 to-violet-500 text-white font-semibold text-base transition-all hover:shadow-xl hover:shadow-violet-500/30 hover:-translate-y-0.5 btn-primary"
          >
            Start for Free
          </Link>
          <Link
            href="/auth/login"
            className="flex-1 px-6 py-3.5 rounded-xl dark:bg-white/5 bg-black/5 dark:border-white/10 border-black/10 border dark:text-white text-gray-900 font-semibold text-base transition-all dark:hover:bg-white/10 hover:bg-black/10"
          >
            Sign In
          </Link>
        </div>

        {/* Install hint */}
        <div className="flex items-center gap-2 mt-6 dark:text-gray-500 text-gray-400 text-sm">
          <Smartphone className="w-4 h-4" />
          <span>Install as app on iOS & Android</span>
        </div>
      </div>

      {/* Features grid */}
      <div className="relative z-10 max-w-5xl mx-auto px-6 pb-24">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { icon: Brain, title: 'Upload Questions', desc: 'Import JSON files with your custom questions and answers instantly.', color: 'text-violet-400' },
            { icon: TrendingUp, title: 'Activity Heatmap', desc: 'GitHub-style heatmap shows your daily practice consistency.', color: 'text-cyan-400' },
            { icon: Trophy, title: 'XP & Levels', desc: 'Earn points for every correct answer, level up, and unlock titles.', color: 'text-yellow-400' },
            { icon: Zap, title: 'Daily Streaks', desc: 'Build habits with streak tracking. Miss a day, break the chain.', color: 'text-orange-400' },
            { icon: Shield, title: 'Your Profile', desc: 'Full gamer profile with avatar, badges, stats, and leaderboard rank.', color: 'text-green-400' },
            { icon: Smartphone, title: 'PWA Ready', desc: 'Install on any device — works offline, feels native.', color: 'text-pink-400' },
          ].map((f) => (
            <div key={f.title} className="glass-card rounded-2xl p-5 group hover:border-violet-500/30 transition-all">
              <div className={`${f.color} mb-3`}>
                <f.icon className="w-6 h-6" />
              </div>
              <h3 className="font-display font-semibold dark:text-white text-gray-900 mb-1.5">{f.title}</h3>
              <p className="dark:text-gray-400 text-gray-500 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
