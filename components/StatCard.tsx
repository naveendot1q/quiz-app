'use client';

import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
  glow?: string;
}

export default function StatCard({ icon: Icon, label, value, sub, color = 'text-violet-400', glow }: StatCardProps) {
  return (
    <div className={`glass-card rounded-2xl p-4 ${glow ? `hover:${glow} transition-shadow` : ''}`}>
      <div className="flex items-start justify-between mb-3">
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center dark:bg-white/5 bg-gray-100 ${color}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className={`font-display font-bold text-2xl dark:text-white text-gray-900 mb-0.5`}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
      <div className="dark:text-gray-400 text-gray-500 text-xs font-medium">{label}</div>
      {sub && <div className="dark:text-gray-500 text-gray-400 text-xs mt-0.5">{sub}</div>}
    </div>
  );
}
