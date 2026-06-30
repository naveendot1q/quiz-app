'use client';

import { calculateLevel, getLevelTitle, getLevelColor, xpToNextLevel } from '@/lib/supabase';
import { Zap, Star } from 'lucide-react';

interface XPBarProps {
  totalXp: number;
  compact?: boolean;
}

export default function XPBar({ totalXp, compact = false }: XPBarProps) {
  const level = calculateLevel(totalXp);
  const { current, needed, progress } = xpToNextLevel(totalXp);
  const title = getLevelTitle(level);
  const color = getLevelColor(level);

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div className={`flex items-center gap-1 text-sm font-bold ${color}`}>
          <Star className="w-3.5 h-3.5" />
          Lv.{level}
        </div>
        <div className="flex-1 h-1.5 rounded-full dark:bg-white/10 bg-gray-200 overflow-hidden min-w-[60px]">
          <div
            className="h-full rounded-full xp-bar"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="dark:text-gray-400 text-gray-500 text-xs">{Math.round(progress)}%</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1.5 font-display font-bold text-lg ${color}`}>
            <Star className="w-5 h-5" />
            Level {level}
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full dark:bg-white/5 bg-gray-100 font-medium ${color}`}>
            {title}
          </span>
        </div>
        <div className="flex items-center gap-1 dark:text-gray-400 text-gray-500 text-xs">
          <Zap className="w-3.5 h-3.5 text-violet-400" />
          <span>{current.toLocaleString()} / {needed.toLocaleString()} XP</span>
        </div>
      </div>

      <div className="h-2 rounded-full dark:bg-white/10 bg-gray-200 overflow-hidden">
        <div
          className="h-full rounded-full xp-bar transition-all duration-1000"
          style={{ width: `${progress}%` }}
        />
      </div>

      <p className="dark:text-gray-500 text-gray-400 text-xs">
        {(needed - current).toLocaleString()} XP to Level {level + 1}
      </p>
    </div>
  );
}
