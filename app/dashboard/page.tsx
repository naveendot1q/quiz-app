'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, QuizSet, calculateLevel } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import ActivityHeatmap from '@/components/ActivityHeatmap';
import XPBar from '@/components/XPBar';
import StatCard from '@/components/StatCard';
import {
  Zap, Target, Flame, BookOpen, Play,
  Plus, ChevronRight, Clock, CheckCircle, Upload,
  Star
} from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [quizSets, setQuizSets] = useState<QuizSet[]>([]);
  const [recentSessions, setRecentSessions] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.push('/auth/login');
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;

    async function fetchData() {
      const [setsRes, sessionsRes] = await Promise.all([
        supabase
          .from('quiz_sets')
          .select('*')
          .eq('user_id', user!.id)
          .order('updated_at', { ascending: false })
          .limit(6),
        supabase
          .from('quiz_sessions')
          .select('*, quiz_sets(title)')
          .eq('user_id', user!.id)
          .eq('completed', true)
          .order('completed_at', { ascending: false })
          .limit(5),
      ]);

      if (setsRes.data) setQuizSets(setsRes.data);
      if (sessionsRes.data) setRecentSessions(sessionsRes.data);
      setLoadingData(false);
    }

    fetchData();
  }, [user]);

  if (loading || !user || !profile) {
    return (
      <div className="min-h-screen dark:bg-[#0a0a0f] bg-[#f0f0f8] flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  const level = calculateLevel(profile.total_xp);
  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="min-h-screen dark:bg-[#0a0a0f] bg-[#f0f0f8] bg-grid">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 pt-20 pb-24">
        {/* Welcome banner */}
        <div className="glass-card rounded-2xl p-5 mb-6 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-violet-900/20 to-transparent pointer-events-none" />
          <div className="relative z-10 flex items-start justify-between">
            <div>
              <p className="dark:text-gray-400 text-gray-500 text-sm">{greeting()},</p>
              <h1 className="font-display font-bold text-2xl dark:text-white text-gray-900 mt-0.5">
                {profile.full_name || profile.username || 'Champion'} 👋
              </h1>
              <div className="mt-3 max-w-sm">
                <XPBar totalXp={profile.total_xp} />
              </div>
            </div>
            <div className="text-right hidden sm:block">
              {profile.streak_days > 0 && (
                <div className="flex flex-col items-center gap-1">
                  <div className="text-3xl">🔥</div>
                  <div className="text-orange-400 font-bold text-lg font-display">{profile.streak_days}</div>
                  <div className="dark:text-gray-400 text-gray-500 text-xs">day streak</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <StatCard
            icon={Zap}
            label="Total XP"
            value={profile.total_xp}
            color="text-violet-400"
          />
          <StatCard
            icon={Star}
            label="Level"
            value={level}
            sub="Keep grinding!"
            color="text-yellow-400"
          />
          <StatCard
            icon={Target}
            label="Total Points"
            value={profile.total_points}
            color="text-cyan-400"
          />
          <StatCard
            icon={Flame}
            label="Best Streak"
            value={`${profile.streak_days}d`}
            color="text-orange-400"
          />
        </div>

        {/* Heatmap */}
        <div className="mb-6">
          <ActivityHeatmap />
        </div>

        {/* Quiz sets */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display font-semibold dark:text-white text-gray-900">My Quiz Sets</h2>
            <Link href="/upload" className="flex items-center gap-1 text-violet-400 hover:text-violet-300 text-sm font-medium transition-colors">
              <Plus className="w-4 h-4" />
              Upload New
            </Link>
          </div>

          {loadingData ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="glass-card rounded-2xl p-5 animate-pulse">
                  <div className="h-4 dark:bg-white/5 bg-gray-200 rounded w-3/4 mb-2" />
                  <div className="h-3 dark:bg-white/5 bg-gray-200 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : quizSets.length === 0 ? (
            <div className="glass-card rounded-2xl p-10 text-center">
              <div className="w-16 h-16 rounded-2xl dark:bg-white/5 bg-gray-100 flex items-center justify-center mx-auto mb-4">
                <BookOpen className="w-8 h-8 dark:text-gray-500 text-gray-400" />
              </div>
              <p className="dark:text-gray-300 text-gray-700 font-medium mb-1">No quiz sets yet</p>
              <p className="dark:text-gray-500 text-gray-400 text-sm mb-4">Upload a JSON file to create your first quiz</p>
              <Link
                href="/upload"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-medium text-sm transition-all"
              >
                <Upload className="w-4 h-4" />
                Upload Questions
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {quizSets.map(set => (
                <QuizSetCard key={set.id} quizSet={set} />
              ))}
            </div>
          )}
        </div>

        {/* Recent activity */}
        {recentSessions.length > 0 && (
          <div>
            <h2 className="font-display font-semibold dark:text-white text-gray-900 mb-3">Recent Sessions</h2>
            <div className="space-y-2">
              {recentSessions.map(session => (
                <div key={session.id} className="glass-card rounded-xl px-4 py-3 flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    session.correct_answers / session.total_questions >= 0.7
                      ? 'bg-green-500/15 text-green-400'
                      : 'bg-orange-500/15 text-orange-400'
                  }`}>
                    <CheckCircle className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="dark:text-white text-gray-900 text-sm font-medium truncate">
                      {session.quiz_sets?.title || 'Quiz'}
                    </p>
                    <p className="dark:text-gray-400 text-gray-500 text-xs">
                      {session.correct_answers}/{session.total_questions} correct
                      · +{session.xp_earned} XP
                    </p>
                  </div>
                  <div className="flex items-center gap-1 dark:text-gray-400 text-gray-500 text-xs shrink-0">
                    <Clock className="w-3 h-3" />
                    {Math.round(session.time_taken / 60)}m
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function QuizSetCard({ quizSet }: { quizSet: QuizSet }) {
  const router = useRouter();

  const accuracy = 0; // Would come from aggregate stats

  return (
    <div className="glass-card rounded-2xl p-5 group hover:border-violet-500/30 transition-all cursor-pointer"
      onClick={() => router.push(`/quiz/${quizSet.id}`)}>
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-700 to-violet-900 flex items-center justify-center">
          <BookOpen className="w-5 h-5 text-violet-300" />
        </div>
        <span className="text-xs px-2 py-0.5 rounded-full dark:bg-white/5 bg-gray-100 dark:text-gray-400 text-gray-500">
          {quizSet.category}
        </span>
      </div>
      <h3 className="font-display font-semibold dark:text-white text-gray-900 mb-1 line-clamp-2 leading-tight">
        {quizSet.title}
      </h3>
      {quizSet.description && (
        <p className="dark:text-gray-400 text-gray-500 text-xs mb-3 line-clamp-2">{quizSet.description}</p>
      )}
      <div className="flex items-center justify-between">
        <span className="dark:text-gray-400 text-gray-500 text-xs">
          {quizSet.question_count} questions
        </span>
        <button className="flex items-center gap-1 text-violet-400 text-sm font-medium group-hover:gap-2 transition-all">
          <Play className="w-3.5 h-3.5 fill-current" />
          Start
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
