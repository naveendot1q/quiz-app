'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, calculateLevel, getLevelTitle, getLevelColor, xpToNextLevel } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import XPBar from '@/components/XPBar';
import ActivityHeatmap from '@/components/ActivityHeatmap';
import {
  Camera, Edit2, Save, X, Star, Zap, Target, Trophy,
  Flame, BookOpen, CheckCircle, Award, TrendingUp, Calendar, Loader2
} from 'lucide-react';
import Image from 'next/image';

const BADGES = [
  { id: 'first_quiz', name: 'First Quiz', icon: '🎯', desc: 'Completed your first quiz' },
  { id: 'streak_7', name: 'Week Warrior', icon: '🔥', desc: '7 day streak' },
  { id: 'streak_30', name: 'Monthly Master', icon: '🌙', desc: '30 day streak' },
  { id: 'perfect_score', name: 'Perfectionist', icon: '💎', desc: 'Got a perfect score' },
  { id: 'level_10', name: 'Veteran', icon: '⚔️', desc: 'Reached level 10' },
  { id: 'quiz_creator', name: 'Quiz Creator', icon: '📚', desc: 'Created 5 quiz sets' },
  { id: 'century', name: 'Century', icon: '💯', desc: 'Answered 100 questions' },
  { id: 'xp_1000', name: 'XP Hunter', icon: '⚡', desc: 'Earned 1000 XP' },
];

export default function ProfilePage() {
  const { user, profile, refreshProfile, loading } = useAuth();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [stats, setStats] = useState<{
    totalSessions: number;
    totalQuestions: number;
    bestAccuracy: number;
    quizSetsCreated: number;
  }>({ totalSessions: 0, totalQuestions: 0, bestAccuracy: 0, quizSetsCreated: 0 });

  useEffect(() => {
    if (!loading && !user) router.push('/auth/login');
  }, [user, loading, router]);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setUsername(profile.username || '');
      setBio(profile.bio || '');
    }
  }, [profile]);

  useEffect(() => {
    if (!user) return;
    async function loadStats() {
      const [sessionsRes, setsRes] = await Promise.all([
        supabase.from('quiz_sessions').select('total_questions, correct_answers').eq('user_id', user!.id).eq('completed', true),
        supabase.from('quiz_sets').select('id', { count: 'exact' }).eq('user_id', user!.id),
      ]);

      if (sessionsRes.data) {
        const totalSessions = sessionsRes.data.length;
        const totalQ = sessionsRes.data.reduce((s, r) => s + r.total_questions, 0);
        const bestAcc = sessionsRes.data.reduce((best, r) => {
          const acc = r.total_questions ? Math.round(r.correct_answers / r.total_questions * 100) : 0;
          return Math.max(best, acc);
        }, 0);
        setStats({
          totalSessions,
          totalQuestions: totalQ,
          bestAccuracy: bestAcc,
          quizSetsCreated: setsRes.count || 0,
        });
      }
    }
    loadStats();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    await supabase.from('profiles').update({
      full_name: fullName.trim() || null,
      username: username.trim().toLowerCase() || null,
      bio: bio.trim() || null,
      updated_at: new Date().toISOString(),
    }).eq('id', user.id);
    await refreshProfile();
    setSaving(false);
    setEditing(false);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploadingAvatar(true);

    const ext = file.name.split('.').pop();
    const path = `${user.id}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true });

    if (!uploadError) {
      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      await supabase.from('profiles').update({
        avatar_url: data.publicUrl,
        updated_at: new Date().toISOString(),
      }).eq('id', user.id);
      await refreshProfile();
    }
    setUploadingAvatar(false);
  };

  if (loading || !user || !profile) {
    return (
      <div className="min-h-screen dark:bg-[#0a0a0f] bg-[#f0f0f8] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
      </div>
    );
  }

  const level = calculateLevel(profile.total_xp);
  const title = getLevelTitle(level);
  const levelColor = getLevelColor(level);
  const { progress } = xpToNextLevel(profile.total_xp);
  const earnedBadges = profile.badges as any[] || [];
  const earnedIds = earnedBadges.map((b: any) => b.id);

  return (
    <div className="min-h-screen dark:bg-[#0a0a0f] bg-[#f0f0f8] bg-grid">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 pt-20 pb-24">

        {/* Hero card */}
        <div className="glass-card rounded-3xl p-6 mb-5 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-900/20 to-transparent pointer-events-none" />

          <div className="relative z-10">
            {/* Avatar + edit */}
            <div className="flex items-start gap-4 mb-5">
              <div className="relative shrink-0">
                <div className="w-20 h-20 rounded-2xl overflow-hidden bg-gradient-to-br from-violet-600 to-violet-900 flex items-center justify-center">
                  {profile.avatar_url ? (
                    <Image src={profile.avatar_url} alt="Avatar" fill className="object-cover" />
                  ) : (
                    <span className="text-white text-3xl font-bold">
                      {(profile.full_name || profile.username || user.email || 'U')[0].toUpperCase()}
                    </span>
                  )}
                  {uploadingAvatar && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <Loader2 className="w-5 h-5 text-white animate-spin" />
                    </div>
                  )}
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute -bottom-1 -right-1 w-7 h-7 rounded-lg bg-violet-600 hover:bg-violet-500 flex items-center justify-center shadow-lg transition-all"
                >
                  <Camera className="w-3.5 h-3.5 text-white" />
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
              </div>

              <div className="flex-1 min-w-0">
                {editing ? (
                  <div className="space-y-2">
                    <input
                      value={fullName}
                      onChange={e => setFullName(e.target.value)}
                      placeholder="Full name"
                      className="w-full px-3 py-2 rounded-xl dark:bg-white/5 bg-gray-100 dark:border-white/10 border-gray-200 border dark:text-white text-gray-900 text-sm focus:outline-none focus:border-violet-500 transition-colors"
                    />
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 dark:text-gray-400 text-gray-400 text-sm">@</span>
                      <input
                        value={username}
                        onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                        placeholder="username"
                        className="w-full pl-7 pr-3 py-2 rounded-xl dark:bg-white/5 bg-gray-100 dark:border-white/10 border-gray-200 border dark:text-white text-gray-900 text-sm focus:outline-none focus:border-violet-500 transition-colors"
                      />
                    </div>
                    <textarea
                      value={bio}
                      onChange={e => setBio(e.target.value)}
                      placeholder="Bio (optional)"
                      rows={2}
                      className="w-full px-3 py-2 rounded-xl dark:bg-white/5 bg-gray-100 dark:border-white/10 border-gray-200 border dark:text-white text-gray-900 text-sm focus:outline-none focus:border-violet-500 transition-colors resize-none"
                    />
                  </div>
                ) : (
                  <div>
                    <h1 className="font-display font-bold text-xl dark:text-white text-gray-900">
                      {profile.full_name || profile.username || 'Anonymous'}
                    </h1>
                    {profile.username && (
                      <p className="dark:text-gray-400 text-gray-500 text-sm">@{profile.username}</p>
                    )}
                    {profile.bio && (
                      <p className="dark:text-gray-300 text-gray-600 text-sm mt-1">{profile.bio}</p>
                    )}
                    <div className={`flex items-center gap-1 text-sm font-semibold mt-1 ${levelColor}`}>
                      <Star className="w-4 h-4" />
                      Level {level} · {title}
                    </div>
                  </div>
                )}
              </div>

              {/* Edit button */}
              <div className="flex gap-2 shrink-0">
                {editing ? (
                  <>
                    <button
                      onClick={() => setEditing(false)}
                      className="w-8 h-8 rounded-lg dark:bg-white/5 bg-gray-100 flex items-center justify-center dark:text-gray-400 text-gray-500 hover:text-red-400 transition-all"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="w-8 h-8 rounded-lg bg-violet-600 hover:bg-violet-500 flex items-center justify-center text-white transition-all disabled:opacity-50"
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setEditing(true)}
                    className="w-8 h-8 rounded-lg dark:bg-white/5 bg-gray-100 flex items-center justify-center dark:text-gray-400 text-gray-500 dark:hover:text-white hover:text-gray-900 transition-all"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* XP bar */}
            <XPBar totalXp={profile.total_xp} />
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {[
            { icon: Zap, label: 'Total XP', value: profile.total_xp.toLocaleString(), color: 'text-violet-400' },
            { icon: Flame, label: 'Streak', value: `${profile.streak_days}d`, color: 'text-orange-400' },
            { icon: Target, label: 'Accuracy', value: `${stats.bestAccuracy}%`, color: 'text-cyan-400' },
            { icon: Trophy, label: 'Points', value: profile.total_points.toLocaleString(), color: 'text-yellow-400' },
            { icon: BookOpen, label: 'Sessions', value: stats.totalSessions, color: 'text-green-400' },
            { icon: CheckCircle, label: 'Questions', value: stats.totalQuestions, color: 'text-blue-400' },
            { icon: TrendingUp, label: 'Quiz Sets', value: stats.quizSetsCreated, color: 'text-pink-400' },
            { icon: Calendar, label: 'Joined', value: new Date(profile.created_at).getFullYear(), color: 'text-gray-400' },
          ].map(s => (
            <div key={s.label} className="glass-card rounded-2xl p-4">
              <s.icon className={`w-4 h-4 ${s.color} mb-2`} />
              <div className="font-display font-bold text-lg dark:text-white text-gray-900">{s.value}</div>
              <div className="dark:text-gray-400 text-gray-500 text-xs">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Activity heatmap */}
        <div className="mb-5">
          <ActivityHeatmap />
        </div>

        {/* Badges */}
        <div className="glass-card rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Award className="w-4 h-4 text-yellow-400" />
            <h3 className="font-display font-semibold dark:text-white text-gray-900 text-sm">Badges</h3>
            <span className="text-xs dark:text-gray-400 text-gray-500">({earnedIds.length}/{BADGES.length} earned)</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {BADGES.map(badge => {
              const earned = earnedIds.includes(badge.id);
              return (
                <div
                  key={badge.id}
                  className={`rounded-xl p-3 text-center transition-all ${
                    earned
                      ? 'badge dark:bg-[#1a1a26] bg-white border-violet-500/20'
                      : 'dark:bg-white/3 bg-gray-100 dark:border-white/5 border-gray-200 border opacity-40 grayscale'
                  }`}
                >
                  <div className="text-2xl mb-1">{badge.icon}</div>
                  <div className={`text-xs font-medium ${earned ? 'dark:text-white text-gray-900' : 'dark:text-gray-500 text-gray-400'}`}>
                    {badge.name}
                  </div>
                  <div className="dark:text-gray-500 text-gray-400 text-[10px] mt-0.5 leading-tight">{badge.desc}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
