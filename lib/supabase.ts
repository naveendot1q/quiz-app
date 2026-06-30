import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

// Types
export interface Profile {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  level: number;
  total_xp: number;
  total_points: number;
  streak_days: number;
  last_active_date: string | null;
  badges: Badge[];
  created_at: string;
  updated_at: string;
}

export interface Badge {
  id: string;
  name: string;
  icon: string;
  earned_at: string;
}

export interface QuizSet {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  category: string;
  question_count: number;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface Question {
  id: string;
  quiz_set_id: string;
  user_id: string;
  question: string;
  options: string[];
  correct_answer: number;
  explanation: string | null;
  difficulty: 'easy' | 'medium' | 'hard';
  points: number;
  created_at: string;
}

export interface QuizSession {
  id: string;
  user_id: string;
  quiz_set_id: string;
  score: number;
  total_questions: number;
  correct_answers: number;
  xp_earned: number;
  time_taken: number;
  completed: boolean;
  answers: SessionAnswer[];
  started_at: string;
  completed_at: string | null;
}

export interface SessionAnswer {
  question_id: string;
  selected: number;
  correct: boolean;
  time_taken: number;
}

export interface DailyActivity {
  id: string;
  user_id: string;
  date: string;
  questions_answered: number;
  correct_answers: number;
  xp_earned: number;
  sessions_count: number;
}

// XP & Level calculations
export const XP_PER_CORRECT = 10;
export const XP_STREAK_BONUS = 5;
export const XP_PERFECT_BONUS = 50;

export function calculateLevel(xp: number): number {
  const safeXp = Number.isFinite(xp) && xp > 0 ? xp : 0;
  return Math.max(1, Math.floor(Math.sqrt(safeXp / 100)) + 1);
}

export function xpToNextLevel(currentXp: number): { current: number; needed: number; progress: number } {
  const level = calculateLevel(currentXp);
  const xpForCurrentLevel = Math.pow(level - 1, 2) * 100;
  const xpForNextLevel = Math.pow(level, 2) * 100;
  const needed = xpForNextLevel - xpForCurrentLevel;
  const current = currentXp - xpForCurrentLevel;
  return {
    current,
    needed,
    progress: Math.min(100, (current / needed) * 100),
  };
}

export function getLevelTitle(level: number): string {
  const titles = [
    'Novice', 'Apprentice', 'Scholar', 'Expert', 'Master',
    'Grand Master', 'Legend', 'Mythic', 'Transcendent', 'Omniscient'
  ];
  const safeLevel = Number.isFinite(level) ? Math.max(1, level) : 1;
  return titles[Math.min(Math.floor((safeLevel - 1) / 5), titles.length - 1)];
}

export function getLevelColor(level: number): string {
  const colors = [
    'text-gray-400', 'text-green-400', 'text-blue-400', 'text-violet-400',
    'text-yellow-400', 'text-orange-400', 'text-red-400', 'text-pink-400',
    'text-cyan-400', 'text-white',
  ];
  const safeLevel = Number.isFinite(level) ? Math.max(1, level) : 1;
  return colors[Math.min(Math.floor((safeLevel - 1) / 5), colors.length - 1)];
}
