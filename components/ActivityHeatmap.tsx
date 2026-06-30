'use client';

import { useEffect, useState } from 'react';
import { supabase, DailyActivity } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { format, subDays, eachDayOfInterval, getDay, startOfWeek } from 'date-fns';
import { Flame } from 'lucide-react';

const WEEKS = 26; // 6 months

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  date: string;
  count: number;
}

export default function ActivityHeatmap() {
  const { user, profile } = useAuth();
  const [activityMap, setActivityMap] = useState<Map<string, DailyActivity>>(new Map());
  const [loading, setLoading] = useState(true);
  const [tooltip, setTooltip] = useState<TooltipState>({ visible: false, x: 0, y: 0, date: '', count: 0 });

  useEffect(() => {
    if (!user) return;

    async function fetchActivity() {
      const startDate = subDays(new Date(), WEEKS * 7);
      const { data } = await supabase
        .from('daily_activity')
        .select('*')
        .eq('user_id', user!.id)
        .gte('date', format(startDate, 'yyyy-MM-dd'))
        .order('date', { ascending: true });

      if (data) {
        const map = new Map<string, DailyActivity>();
        data.forEach((d: DailyActivity) => map.set(d.date, d));
        setActivityMap(map);
      }
      setLoading(false);
    }

    fetchActivity();
  }, [user]);

  // Build calendar grid
  const today = new Date();
  const startDate = subDays(today, WEEKS * 7 - 1);

  // Find start of first week (Sunday)
  const gridStart = startOfWeek(startDate, { weekStartsOn: 0 });

  const allDays = eachDayOfInterval({ start: gridStart, end: today });

  // Pad to fill last week
  const weeks: (Date | null)[][] = [];
  let week: (Date | null)[] = [];

  // Fill initial padding
  const firstDayOfWeek = getDay(gridStart);
  for (let i = 0; i < firstDayOfWeek; i++) week.push(null);

  allDays.forEach(day => {
    week.push(day);
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  });
  if (week.length > 0) {
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }

  function getIntensity(date: Date | null): number {
    if (!date) return -1;
    const dateStr = format(date, 'yyyy-MM-dd');
    const activity = activityMap.get(dateStr);
    if (!activity) return 0;
    const q = activity.questions_answered;
    if (q >= 50) return 5;
    if (q >= 30) return 4;
    if (q >= 20) return 3;
    if (q >= 10) return 2;
    if (q >= 1) return 1;
    return 0;
  }

  const totalQuestions = Array.from(activityMap.values()).reduce(
    (sum, a) => sum + a.questions_answered, 0
  );

  const monthLabels: { label: string; colIndex: number }[] = [];
  weeks.forEach((week, i) => {
    const firstValidDay = week.find(d => d !== null);
    if (firstValidDay && firstValidDay.getDate() <= 7) {
      monthLabels.push({ label: format(firstValidDay, 'MMM'), colIndex: i });
    }
  });

  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  if (loading) {
    return (
      <div className="glass-card rounded-2xl p-5 animate-pulse">
        <div className="h-4 dark:bg-white/5 bg-gray-200 rounded w-32 mb-4" />
        <div className="h-24 dark:bg-white/5 bg-gray-200 rounded" />
      </div>
    );
  }

  return (
    <div className="glass-card rounded-2xl p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-display font-semibold dark:text-white text-gray-900 text-sm">Practice Activity</h3>
          <p className="dark:text-gray-400 text-gray-500 text-xs mt-0.5">{totalQuestions.toLocaleString()} questions in the last 6 months</p>
        </div>
        {profile && profile.streak_days > 0 && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-500/15 border border-orange-500/20">
            <Flame className="w-3.5 h-3.5 text-orange-400" />
            <span className="text-orange-400 text-xs font-bold">{profile.streak_days}d streak</span>
          </div>
        )}
      </div>

      {/* Heatmap grid */}
      <div className="overflow-x-auto">
        <div className="min-w-max">
          {/* Month labels */}
          <div className="flex ml-8 mb-1 gap-[3px]">
            {weeks.map((_, i) => {
              const monthLabel = monthLabels.find(m => m.colIndex === i);
              return (
                <div key={i} className="w-3 flex-shrink-0">
                  {monthLabel && (
                    <span className="dark:text-gray-500 text-gray-400 text-[9px]">{monthLabel.label}</span>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex gap-1">
            {/* Day labels */}
            <div className="flex flex-col gap-[3px] mr-1">
              {dayLabels.map((day, i) => (
                <div key={day} className="h-3 flex items-center">
                  {i % 2 === 1 && (
                    <span className="dark:text-gray-500 text-gray-400 text-[9px] w-6 text-right">{day.slice(0, 1)}</span>
                  )}
                  {i % 2 !== 1 && <span className="w-6" />}
                </div>
              ))}
            </div>

            {/* Grid */}
            <div className="flex gap-[3px]">
              {weeks.map((week, wi) => (
                <div key={wi} className="flex flex-col gap-[3px]">
                  {week.map((day, di) => {
                    const intensity = getIntensity(day);
                    if (intensity === -1 || !day) {
                      return <div key={di} className="w-3 h-3" />;
                    }
                    return (
                      <div
                        key={di}
                        className={`w-3 h-3 heatmap-cell heatmap-cell-${intensity}`}
                        onMouseEnter={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const activity = activityMap.get(format(day, 'yyyy-MM-dd'));
                          setTooltip({
                            visible: true,
                            x: rect.left + rect.width / 2,
                            y: rect.top - 8,
                            date: format(day, 'MMM d, yyyy'),
                            count: activity?.questions_answered || 0,
                          });
                        }}
                        onMouseLeave={() => setTooltip(t => ({ ...t, visible: false }))}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-1.5 mt-3 ml-8">
            <span className="dark:text-gray-500 text-gray-400 text-[9px]">Less</span>
            {[0, 1, 2, 3, 4, 5].map(i => (
              <div key={i} className={`w-3 h-3 rounded-sm heatmap-cell heatmap-cell-${i}`} />
            ))}
            <span className="dark:text-gray-500 text-gray-400 text-[9px]">More</span>
          </div>
        </div>
      </div>

      {/* Tooltip */}
      {tooltip.visible && (
        <div
          className="fixed z-50 px-2.5 py-1.5 rounded-lg dark:bg-[#1a1a26] bg-white dark:border-white/10 border-gray-200 border shadow-xl text-xs pointer-events-none -translate-x-1/2 -translate-y-full"
          style={{ left: tooltip.x, top: tooltip.y - 4 }}
        >
          <p className="dark:text-white text-gray-900 font-medium">{tooltip.date}</p>
          <p className="dark:text-gray-400 text-gray-500">{tooltip.count} questions</p>
        </div>
      )}
    </div>
  );
}
