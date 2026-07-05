-- =============================================
-- Quiz Master Pro - Migration v2
-- Run this in your Supabase SQL editor AFTER
-- the original supabase-schema.sql
-- =============================================

-- 1. Add paused session support to quiz_sessions
ALTER TABLE public.quiz_sessions
  ADD COLUMN IF NOT EXISTS paused BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS paused_at_index INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS question_order JSONB DEFAULT '[]'::jsonb;

-- 2. Add topic editing support to quiz_sets
ALTER TABLE public.quiz_sets
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- 3. Daily streak tracking — add questions_today to profiles
--    (streak logic now based on daily_activity, no schema change needed)

-- 4. Random quiz sessions table (AI-generated questions stored temporarily)
CREATE TABLE IF NOT EXISTS public.random_quiz_sessions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  question_count INTEGER DEFAULT 10,
  completed BOOLEAN DEFAULT FALSE,
  score INTEGER DEFAULT 0,
  correct_answers INTEGER DEFAULT 0,
  xp_earned INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- RLS for random quiz sessions
ALTER TABLE public.random_quiz_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own random sessions"
  ON public.random_quiz_sessions FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 5. Function to check and update streak based on daily_activity
--    Streak increments only if user answered >= 25 questions today
--    Streak breaks if last_active_date is older than yesterday
CREATE OR REPLACE FUNCTION public.update_streak_after_activity(
  p_user_id UUID,
  p_date DATE
)
RETURNS JSONB AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_today_activity public.daily_activity%ROWTYPE;
  v_yesterday DATE := p_date - INTERVAL '1 day';
  v_new_streak INTEGER;
  v_streak_achieved BOOLEAN := FALSE;
BEGIN
  -- Get current profile
  SELECT * INTO v_profile FROM public.profiles WHERE id = p_user_id;

  -- Get today's activity
  SELECT * INTO v_today_activity
  FROM public.daily_activity
  WHERE user_id = p_user_id AND date = p_date;

  -- Check if 25 questions answered today
  IF v_today_activity.questions_answered >= 25 THEN
    v_streak_achieved := TRUE;

    IF v_profile.last_active_date = p_date THEN
      -- Already counted today, keep streak
      v_new_streak := v_profile.streak_days;
    ELSIF v_profile.last_active_date = v_yesterday THEN
      -- Consecutive day — increment
      v_new_streak := v_profile.streak_days + 1;
    ELSE
      -- Gap in days — reset to 1
      v_new_streak := 1;
    END IF;

    -- Update profile streak and last active
    UPDATE public.profiles SET
      streak_days = v_new_streak,
      last_active_date = p_date,
      updated_at = NOW()
    WHERE id = p_user_id;

  ELSE
    -- Not enough questions today, check if streak should break
    -- Streak breaks if last active was before yesterday
    IF v_profile.last_active_date < v_yesterday THEN
      UPDATE public.profiles SET
        streak_days = 0,
        updated_at = NOW()
      WHERE id = p_user_id;
      v_new_streak := 0;
    ELSE
      v_new_streak := v_profile.streak_days;
    END IF;
    v_streak_achieved := FALSE;
  END IF;

  RETURN jsonb_build_object(
    'streak_days', v_new_streak,
    'streak_achieved', v_streak_achieved,
    'questions_today', COALESCE(v_today_activity.questions_answered, 0)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
