'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, calculateLevel, getLevelColor } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import { Trophy, Zap, Star, Crown, Medal, Loader2 } from 'lucide-react';
import Image from 'next/image';

interface LeaderboardEntry {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  level: number;
  total_xp: number;
  total_points: number;
  streak_days: number;
  rank: number;
}

const RANK_ICONS = [
  <Crown key="1" className="w-5 h-5 text-yellow-400" />,
  <Medal key="2" className="w-5 h-5 text-gray-300" />,
  <Medal key="3" className="w-5 h-5 text-amber-600" />,
];

export default function LeaderboardPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [tab, setTab] = useState<'xp' | 'points' | 'streak'>('xp');

  useEffect(() => {
    if (!loading && !user) router.push('/auth/login');
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    async function fetchLeaderboard() {
      setLoadingData(true);
      const orderCol = tab === 'xp' ? 'total_xp' : tab === 'points' ? 'total_points' : 'streak_days';
      const { data } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url, level, total_xp, total_points, streak_days')
        .order(orderCol, { ascending: false })
        .limit(50);

      if (data) {
        setEntries(data.map((d, i) => ({ ...d, rank: i + 1 })));
      }
      setLoadingData(false);
    }
    fetchLeaderboard();
  }, [user, tab]);

  if (loading || !user) {
    return (
      <div className="min-h-screen dark:bg-[#0a0a0f] bg-[#f0f0f8] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
      </div>
    );
  }

  const myRank = entries.findIndex(e => e.id === user.id) + 1;

  return (
    <div className="min-h-screen dark:bg-[#0a0a0f] bg-[#f0f0f8] bg-grid">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 pt-20 pb-24">
        {/* Header */}
        <div className="mb-6 pt-6">
          <div className="flex items-center gap-3 mb-2">
            <Trophy className="w-6 h-6 text-yellow-400" />
            <h1 className="font-display font-bold text-3xl dark:text-white text-gray-900">Leaderboard</h1>
          </div>
          {myRank > 0 && (
            <p className="dark:text-gray-400 text-gray-500 text-sm">
              You're ranked <span className="text-violet-400 font-semibold">#{myRank}</span> globally
            </p>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 dark:bg-white/5 bg-gray-100 rounded-xl mb-5">
          {(['xp', 'points', 'streak'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all capitalize ${
                tab === t
                  ? 'dark:bg-[#1a1a26] bg-white dark:text-white text-gray-900 shadow-sm'
                  : 'dark:text-gray-400 text-gray-500 dark:hover:text-white hover:text-gray-900'
              }`}
            >
              {t === 'xp' ? 'XP' : t === 'points' ? 'Points' : 'Streak'}
            </button>
          ))}
        </div>

        {/* Top 3 podium */}
        {!loadingData && entries.length >= 3 && (
          <div className="flex items-end justify-center gap-3 mb-6">
            {[entries[1], entries[0], entries[2]].map((entry, podiumIdx) => {
              const heights = ['h-20', 'h-28', 'h-16'];
              const positions = [2, 1, 3];
              const pos = positions[podiumIdx];

              return (
                <div key={entry.id} className="flex flex-col items-center gap-2 flex-1">
                  <div className="relative">
                    <div className="w-12 h-12 rounded-2xl overflow-hidden dark:bg-[#1a1a26] bg-white flex items-center justify-center border-2 border-violet-500/30">
                      {entry.avatar_url ? (
                        <Image src={entry.avatar_url} alt="" width={48} height={48} className="object-cover" />
                      ) : (
                        <span className="text-lg font-bold dark:text-white text-gray-900">
                          {(entry.username || entry.full_name || '?')[0].toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="absolute -top-2 -right-2">
                      {RANK_ICONS[pos - 1]}
                    </div>
                  </div>
                  <p className="dark:text-gray-300 text-gray-700 text-xs font-medium truncate max-w-[70px] text-center">
                    {entry.username || entry.full_name || 'User'}
                  </p>
                  <div className={`w-full ${heights[podiumIdx]} rounded-t-xl flex items-center justify-center ${
                    pos === 1 ? 'bg-gradient-to-t from-yellow-700 to-yellow-500'
                    : pos === 2 ? 'bg-gradient-to-t from-gray-700 to-gray-500'
                    : 'bg-gradient-to-t from-amber-800 to-amber-600'
                  }`}>
                    <span className="font-display font-bold text-white text-sm">#{pos}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* List */}
        {loadingData ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="glass-card rounded-2xl p-4 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl dark:bg-white/5 bg-gray-200" />
                  <div className="flex-1 space-y-1">
                    <div className="h-3 dark:bg-white/5 bg-gray-200 rounded w-1/3" />
                    <div className="h-2 dark:bg-white/5 bg-gray-200 rounded w-1/4" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {entries.map((entry, i) => {
              const isMe = entry.id === user.id;
              const level = calculateLevel(entry.total_xp);
              const levelColor = getLevelColor(level);
              const value = tab === 'xp' ? `${entry.total_xp.toLocaleString()} XP`
                : tab === 'points' ? `${entry.total_points.toLocaleString()} pts`
                : `${entry.streak_days}d streak`;

              return (
                <div
                  key={entry.id}
                  className={`rounded-2xl px-4 py-3 flex items-center gap-3 transition-all ${
                    isMe
                      ? 'bg-violet-500/15 border border-violet-500/30'
                      : 'glass-card hover:border-violet-500/20'
                  }`}
                >
                  {/* Rank */}
                  <div className="w-7 text-center shrink-0">
                    {i < 3
                      ? RANK_ICONS[i]
                      : <span className="dark:text-gray-500 text-gray-400 text-sm font-mono">#{i + 1}</span>
                    }
                  </div>

                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-xl overflow-hidden dark:bg-[#1a1a26] bg-gray-100 flex items-center justify-center shrink-0">
                    {entry.avatar_url ? (
                      <Image src={entry.avatar_url} alt="" width={36} height={36} className="object-cover" />
                    ) : (
                      <span className="font-bold text-sm dark:text-white text-gray-900">
                        {(entry.username || entry.full_name || '?')[0].toUpperCase()}
                      </span>
                    )}
                  </div>

                  {/* Name */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold truncate ${isMe ? 'text-violet-300' : 'dark:text-white text-gray-900'}`}>
                      {entry.username || entry.full_name || 'Anonymous'}
                      {isMe && <span className="ml-1 text-xs font-normal text-violet-400">(you)</span>}
                    </p>
                    <div className={`flex items-center gap-1 text-xs ${levelColor}`}>
                      <Star className="w-3 h-3" />
                      Level {level}
                    </div>
                  </div>

                  {/* Value */}
                  <div className="flex items-center gap-1 shrink-0">
                    {tab === 'xp' && <Zap className="w-3.5 h-3.5 text-violet-400" />}
                    {tab === 'streak' && <span className="text-sm">🔥</span>}
                    <span className={`text-sm font-bold ${isMe ? 'text-violet-300' : 'dark:text-white text-gray-900'}`}>
                      {value}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
