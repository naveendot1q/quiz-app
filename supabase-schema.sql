-- =============================================
-- Quiz Master Pro - Supabase Schema
-- Run this in your Supabase SQL editor
-- =============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- PROFILES TABLE (extends auth.users)
-- =============================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  level INTEGER DEFAULT 1,
  total_xp INTEGER DEFAULT 0,
  total_points INTEGER DEFAULT 0,
  streak_days INTEGER DEFAULT 0,
  last_active_date DATE,
  badges JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- QUIZ SETS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.quiz_sets (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'General',
  question_count INTEGER DEFAULT 0,
  is_public BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- QUESTIONS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.questions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  quiz_set_id UUID REFERENCES public.quiz_sets(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  options JSONB NOT NULL,
  correct_answer INTEGER NOT NULL,
  explanation TEXT,
  difficulty TEXT DEFAULT 'medium',
  points INTEGER DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- QUIZ SESSIONS TABLE (individual quiz attempts)
-- =============================================
CREATE TABLE IF NOT EXISTS public.quiz_sessions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  quiz_set_id UUID REFERENCES public.quiz_sets(id) ON DELETE CASCADE,
  score INTEGER DEFAULT 0,
  total_questions INTEGER DEFAULT 0,
  correct_answers INTEGER DEFAULT 0,
  xp_earned INTEGER DEFAULT 0,
  time_taken INTEGER DEFAULT 0, -- in seconds
  completed BOOLEAN DEFAULT FALSE,
  answers JSONB DEFAULT '[]'::jsonb,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- =============================================
-- DAILY ACTIVITY TABLE (for heatmap)
-- =============================================
CREATE TABLE IF NOT EXISTS public.daily_activity (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  questions_answered INTEGER DEFAULT 0,
  correct_answers INTEGER DEFAULT 0,
  xp_earned INTEGER DEFAULT 0,
  sessions_count INTEGER DEFAULT 0,
  UNIQUE(user_id, date)
);

-- =============================================
-- LEADERBOARD VIEW
-- =============================================
CREATE OR REPLACE VIEW public.leaderboard AS
SELECT
  p.id,
  p.username,
  p.full_name,
  p.avatar_url,
  p.level,
  p.total_xp,
  p.total_points,
  p.streak_days,
  RANK() OVER (ORDER BY p.total_xp DESC) as rank
FROM public.profiles p
ORDER BY p.total_xp DESC
LIMIT 100;

-- =============================================
-- FUNCTIONS
-- =============================================

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, username, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update daily activity upsert function
CREATE OR REPLACE FUNCTION public.upsert_daily_activity(
  p_user_id UUID,
  p_date DATE,
  p_questions INTEGER,
  p_correct INTEGER,
  p_xp INTEGER
)
RETURNS void AS $$
BEGIN
  INSERT INTO public.daily_activity (user_id, date, questions_answered, correct_answers, xp_earned, sessions_count)
  VALUES (p_user_id, p_date, p_questions, p_correct, p_xp, 1)
  ON CONFLICT (user_id, date)
  DO UPDATE SET
    questions_answered = daily_activity.questions_answered + p_questions,
    correct_answers = daily_activity.correct_answers + p_correct,
    xp_earned = daily_activity.xp_earned + p_xp,
    sessions_count = daily_activity.sessions_count + 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Level calculation function
CREATE OR REPLACE FUNCTION public.calculate_level(xp INTEGER)
RETURNS INTEGER AS $$
BEGIN
  RETURN GREATEST(1, FLOOR(SQRT(xp::FLOAT / 100))::INTEGER + 1);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_activity ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read all, write own
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Quiz sets: users can read their own + public ones
CREATE POLICY "Quiz sets viewable by owner or public" ON public.quiz_sets FOR SELECT USING (user_id = auth.uid() OR is_public = true);
CREATE POLICY "Users can insert own quiz sets" ON public.quiz_sets FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own quiz sets" ON public.quiz_sets FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own quiz sets" ON public.quiz_sets FOR DELETE USING (user_id = auth.uid());

-- Questions: viewable if quiz is public or owned
CREATE POLICY "Questions viewable by quiz owner" ON public.questions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own questions" ON public.questions FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own questions" ON public.questions FOR DELETE USING (user_id = auth.uid());

-- Quiz sessions: own only
CREATE POLICY "Users can view own sessions" ON public.quiz_sessions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own sessions" ON public.quiz_sessions FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own sessions" ON public.quiz_sessions FOR UPDATE USING (user_id = auth.uid());

-- Daily activity: own only
CREATE POLICY "Users can view own activity" ON public.daily_activity FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can upsert own activity" ON public.daily_activity FOR ALL USING (user_id = auth.uid());

-- Storage bucket for avatars
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT DO NOTHING;

CREATE POLICY "Avatar images are publicly accessible." ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Anyone can upload an avatar." ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars');
CREATE POLICY "Anyone can update their own avatar." ON storage.objects FOR UPDATE USING (auth.uid()::text = (storage.foldername(name))[1]);
