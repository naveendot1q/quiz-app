'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, Question, QuizSet, XP_PERFECT_BONUS } from '@/lib/supabase';
import { format } from 'date-fns';
import {
  X, ChevronRight, CheckCircle, XCircle, Zap, Trophy,
  RotateCcw, Home, Target, Loader2, BookOpen
} from 'lucide-react';

type QuizState = 'loading' | 'preview' | 'playing' | 'reviewing' | 'finished';

interface SessionAnswer {
  question_id: string;
  selected: number;
  correct: boolean;
  time_taken: number;
}

// Confetti particles
function Confetti() {
  const colors = ['#8b5cf6', '#22d3ee', '#00ff88', '#ff6b35', '#fbbf24'];
  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {Array.from({ length: 40 }).map((_, i) => (
        <div
          key={i}
          className="confetti-particle absolute w-2 h-2 rounded-sm"
          style={{
            left: `${Math.random() * 100}%`,
            top: `-10px`,
            background: colors[Math.floor(Math.random() * colors.length)],
            animationDuration: `${1.5 + Math.random() * 2}s`,
            animationDelay: `${Math.random() * 0.5}s`,
          }}
        />
      ))}
    </div>
  );
}

// Score float element
function ScoreFloat({ value, x, y, onDone }: { value: number; x: number; y: number; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 1200);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div
      className="fixed pointer-events-none z-50 font-display font-bold text-xl text-violet-400 score-float"
      style={{ left: x, top: y }}
    >
      +{value} XP
    </div>
  );
}

export default function QuizPage() {
  const { user, profile, refreshProfile } = useAuth();
  const router = useRouter();
  const params = useParams();
  const quizSetId = params.id as string;

  const [state, setState] = useState<QuizState>('loading');
  const [quizSet, setQuizSet] = useState<QuizSet | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [answers, setAnswers] = useState<SessionAnswer[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [totalScore, setTotalScore] = useState(0);
  const [totalXpEarned, setTotalXpEarned] = useState(0);
  const [questionStartTime, setQuestionStartTime] = useState(0);
  const [sessionStartTime] = useState(Date.now());
  const [scoreFloats, setScoreFloats] = useState<{ id: number; value: number; x: number; y: number }[]>([]);
  const [showConfetti, setShowConfetti] = useState(false);

  // Load quiz data
  useEffect(() => {
    if (!user) { router.push('/auth/login'); return; }

    async function loadQuiz() {
      const [setRes, qRes] = await Promise.all([
        supabase.from('quiz_sets').select('*').eq('id', quizSetId).single(),
        supabase.from('questions').select('*').eq('quiz_set_id', quizSetId).order('created_at'),
      ]);

      if (setRes.error || !setRes.data) { router.push('/dashboard'); return; }

      setQuizSet(setRes.data);
      if (qRes.data && qRes.data.length > 0) {
        // Shuffle questions
        const shuffled = [...qRes.data].sort(() => Math.random() - 0.5);
        setQuestions(shuffled);
        setState('preview');
      } else {
        setState('preview');
      }
    }

    loadQuiz();
  }, [user, quizSetId, router]);

  const startQuiz = async () => {
    if (!user || questions.length === 0) return;

    // Create session
    const { data: session } = await supabase
      .from('quiz_sessions')
      .insert({
        user_id: user.id,
        quiz_set_id: quizSetId,
        total_questions: questions.length,
      })
      .select()
      .single();

    if (session) setSessionId(session.id);
    setCurrentIdx(0);
    setAnswers([]);
    setTotalScore(0);
    setTotalXpEarned(0);
    setQuestionStartTime(Date.now());
    setState('playing');
  };

  const handleAnswer = useCallback(async (optionIdx: number, event?: React.MouseEvent) => {
    if (isAnswered || state !== 'playing') return;

    const q = questions[currentIdx];
    const correct = optionIdx === q.correct_answer;
    const timeTaken = Math.round((Date.now() - questionStartTime) / 1000);

    setSelectedOption(optionIdx);
    setIsAnswered(true);

    const xpGained = correct ? q.points : 0;
    const scoreGained = correct ? q.points : 0;

    if (correct) {
      setTotalScore(s => s + scoreGained);
      setTotalXpEarned(x => x + xpGained);

      // Score float
      if (event) {
        const id = Date.now();
        setScoreFloats(f => [...f, { id, value: xpGained, x: event.clientX, y: event.clientY - 30 }]);
      }
    }

    const answer: SessionAnswer = {
      question_id: q.id,
      selected: optionIdx,
      correct,
      time_taken: timeTaken,
    };

    setAnswers(prev => [...prev, answer]);
  }, [isAnswered, state, questions, currentIdx, questionStartTime]);

  const finishQuiz = useCallback(async () => {
    if (!user || !sessionId) {
      setState('finished');
      return;
    }

    const correctCount = answers.filter(a => a.correct).length;
    const totalQ = questions.length;
    const isPerfect = correctCount === totalQ;
    const bonusXp = isPerfect ? XP_PERFECT_BONUS : 0;
    const finalXp = totalXpEarned + bonusXp;
    const timeTaken = Math.round((Date.now() - sessionStartTime) / 1000);

    // Update session
    await supabase.from('quiz_sessions').update({
      score: totalScore,
      correct_answers: correctCount,
      xp_earned: finalXp,
      time_taken: timeTaken,
      completed: true,
      answers: answers,
      completed_at: new Date().toISOString(),
    }).eq('id', sessionId);

    // Update profile XP + points
    if (profile) {
      const newXp = profile.total_xp + finalXp;
      const newPoints = profile.total_points + totalScore;
      const today = format(new Date(), 'yyyy-MM-dd');
      const lastActive = profile.last_active_date;
      const yesterday = format(new Date(Date.now() - 86400000), 'yyyy-MM-dd');
      const newStreak = lastActive === yesterday ? profile.streak_days + 1
        : lastActive === today ? profile.streak_days : 1;

      await supabase.from('profiles').update({
        total_xp: newXp,
        total_points: newPoints,
        streak_days: newStreak,
        last_active_date: today,
        updated_at: new Date().toISOString(),
      }).eq('id', user.id);

      // Upsert daily activity
      await supabase.rpc('upsert_daily_activity', {
        p_user_id: user.id,
        p_date: today,
        p_questions: totalQ,
        p_correct: correctCount,
        p_xp: finalXp,
      });
    }

    await refreshProfile();

    if (isPerfect) setShowConfetti(true);
    setTotalXpEarned(totalXpEarned + bonusXp);
    setState('finished');
  }, [user, sessionId, answers, questions.length, totalXpEarned, sessionStartTime, totalScore, profile, refreshProfile]);

  const handleNext = useCallback(() => {
    if (currentIdx < questions.length - 1) {
      setCurrentIdx(i => i + 1);
      setSelectedOption(null);
      setIsAnswered(false);
      setQuestionStartTime(Date.now());
    } else {
      finishQuiz();
    }
  }, [currentIdx, questions.length, finishQuiz]);

  // Keyboard shortcut 1-4 and Enter
  useEffect(() => {
    if (state !== 'playing') return;
    const handler = (e: KeyboardEvent) => {
      if (e.key >= '1' && e.key <= '4') {
        const idx = parseInt(e.key) - 1;
        if (idx < questions[currentIdx]?.options.length) handleAnswer(idx);
      }
      if (e.key === 'Enter' && isAnswered) handleNext();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [state, isAnswered, currentIdx, questions, handleAnswer, handleNext]);

  const q = questions[currentIdx];
  const progress = questions.length ? ((currentIdx) / questions.length) * 100 : 0;
  const finalCorrect = answers.filter(a => a.correct).length;
  const accuracy = questions.length ? Math.round((finalCorrect / questions.length) * 100) : 0;

  // ——— LOADING ———
  if (state === 'loading') {
    return (
      <div className="min-h-screen dark:bg-[#0a0a0f] bg-[#f0f0f8] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
      </div>
    );
  }

  // ——— PREVIEW ———
  if (state === 'preview') {
    return (
      <div className="min-h-screen dark:bg-[#0a0a0f] bg-[#f0f0f8] flex items-center justify-center px-4">
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/3 w-[500px] h-[500px] bg-violet-900/15 blur-[120px] rounded-full" />
        </div>
        <div className="relative z-10 w-full max-w-md text-center">
          <div className="glass-card rounded-3xl p-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-700 to-violet-900 flex items-center justify-center mx-auto mb-5 animate-float glow-violet">
              <BookOpen className="w-8 h-8 text-violet-200" />
            </div>
            <h1 className="font-display font-bold text-2xl dark:text-white text-gray-900 mb-2">
              {quizSet?.title}
            </h1>
            {quizSet?.description && (
              <p className="dark:text-gray-400 text-gray-500 text-sm mb-4">{quizSet.description}</p>
            )}

            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="dark:bg-white/5 bg-gray-100 rounded-xl p-3">
                <div className="font-display font-bold text-lg dark:text-white text-gray-900">{questions.length}</div>
                <div className="dark:text-gray-400 text-gray-500 text-xs">Questions</div>
              </div>
              <div className="dark:bg-white/5 bg-gray-100 rounded-xl p-3">
                <div className="font-display font-bold text-lg text-violet-400">{questions.length * 10}</div>
                <div className="dark:text-gray-400 text-gray-500 text-xs">Max XP</div>
              </div>
              <div className="dark:bg-white/5 bg-gray-100 rounded-xl p-3">
                <div className="font-display font-bold text-lg text-cyan-400">{quizSet?.category}</div>
                <div className="dark:text-gray-400 text-gray-500 text-xs">Category</div>
              </div>
            </div>

            <p className="dark:text-gray-500 text-gray-400 text-xs mb-6">
              Tip: Press <kbd className="px-1.5 py-0.5 rounded dark:bg-white/10 bg-gray-200 text-xs font-mono">1-4</kbd> to answer,{' '}
              <kbd className="px-1.5 py-0.5 rounded dark:bg-white/10 bg-gray-200 text-xs font-mono">Enter</kbd> to continue
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => router.push('/dashboard')}
                className="flex-1 py-3 rounded-xl dark:bg-white/5 bg-gray-100 dark:text-gray-300 text-gray-600 font-medium text-sm transition-all dark:hover:bg-white/10 hover:bg-gray-200 flex items-center justify-center gap-2"
              >
                <Home className="w-4 h-4" />
                Back
              </button>
              <button
                onClick={startQuiz}
                disabled={questions.length === 0}
                className="flex-2 flex-grow py-3 rounded-xl bg-gradient-to-r from-violet-700 to-violet-500 text-white font-bold text-sm transition-all hover:shadow-xl hover:shadow-violet-500/30 disabled:opacity-50 btn-primary flex items-center justify-center gap-2"
              >
                <Zap className="w-4 h-4" />
                Start Quiz!
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ——— PLAYING ———
  if (state === 'playing' && q) {
    const optionLabels = ['A', 'B', 'C', 'D', 'E'];

    return (
      <div className="quiz-fullscreen dark:bg-[#0a0a0f] bg-[#f0f0f8] quiz-content">
        {/* Score floats */}
        {scoreFloats.map(sf => (
          <ScoreFloat
            key={sf.id}
            value={sf.value}
            x={sf.x}
            y={sf.y}
            onDone={() => setScoreFloats(f => f.filter(x => x.id !== sf.id))}
          />
        ))}

        <div className="min-h-screen flex flex-col">
          {/* Header bar */}
          <div className="flex items-center gap-3 px-4 pt-safe-top pt-4 pb-3">
            <button
              onClick={() => router.push('/dashboard')}
              className="w-8 h-8 rounded-lg dark:bg-white/5 bg-gray-200 flex items-center justify-center dark:text-gray-400 text-gray-500 hover:text-red-400 dark:hover:bg-white/10 transition-all shrink-0"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Progress bar */}
            <div className="flex-1 h-2 dark:bg-white/10 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full progress-bar"
                style={{ width: `${progress}%` }}
              />
            </div>

            {/* Q counter */}
            <div className="dark:text-gray-400 text-gray-500 text-sm font-mono shrink-0">
              {currentIdx + 1}/{questions.length}
            </div>

            {/* Score */}
            <div className="flex items-center gap-1 dark:bg-violet-500/10 bg-violet-100 px-2.5 py-1 rounded-full shrink-0">
              <Zap className="w-3.5 h-3.5 text-violet-400" />
              <span className="text-violet-400 text-xs font-bold">{totalXpEarned}</span>
            </div>
          </div>

          {/* Question */}
          <div className="flex-1 flex flex-col justify-center px-4 max-w-2xl mx-auto w-full">
            <div className="mb-8 animate-slide-up">
              <div className="text-xs font-medium dark:text-gray-500 text-gray-400 mb-3 uppercase tracking-widest">
                Question {currentIdx + 1}
              </div>
              <h2 className="font-display font-semibold text-xl sm:text-2xl dark:text-white text-gray-900 leading-tight">
                {q.question}
              </h2>
            </div>

            {/* Options */}
            <div className="space-y-3">
              {q.options.map((opt, idx) => {
                let btnClass = 'option-btn w-full text-left px-4 py-4 rounded-2xl border-2 transition-all flex items-center gap-3 ';
                if (!isAnswered) {
                  btnClass += 'dark:bg-[#1a1a26] bg-white dark:border-white/10 border-gray-200 dark:hover:border-violet-500/50 hover:border-violet-400 dark:text-white text-gray-900';
                } else if (idx === q.correct_answer) {
                  btnClass += 'border-green-500 dark:bg-green-500/10 bg-green-50 dark:text-white text-gray-900';
                } else if (idx === selectedOption) {
                  btnClass += 'border-red-500 dark:bg-red-500/10 bg-red-50 dark:text-white text-gray-900';
                } else {
                  btnClass += 'dark:bg-[#1a1a26]/50 bg-white/50 dark:border-white/5 border-gray-100 dark:text-gray-500 text-gray-400';
                }

                return (
                  <button
                    key={idx}
                    className={btnClass}
                    onClick={(e) => handleAnswer(idx, e)}
                    disabled={isAnswered}
                  >
                    <span className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 transition-all ${
                      !isAnswered
                        ? 'dark:bg-white/10 bg-gray-100 dark:text-gray-300 text-gray-600'
                        : idx === q.correct_answer
                          ? 'bg-green-500 text-white'
                          : idx === selectedOption
                            ? 'bg-red-500 text-white'
                            : 'dark:bg-white/5 bg-gray-200 dark:text-gray-500 text-gray-400'
                    }`}>
                      {isAnswered && idx === q.correct_answer ? (
                        <CheckCircle className="w-4 h-4" />
                      ) : isAnswered && idx === selectedOption ? (
                        <XCircle className="w-4 h-4" />
                      ) : (
                        optionLabels[idx]
                      )}
                    </span>
                    <span className="text-sm leading-snug">{opt}</span>
                  </button>
                );
              })}
            </div>

            {/* Explanation + Next */}
            {isAnswered && (
              <div className="mt-5 space-y-3 animate-slide-up">
                {q.explanation && (
                  <div className="px-4 py-3 rounded-2xl dark:bg-white/5 bg-gray-100 dark:border-white/10 border-gray-200 border">
                    <p className="dark:text-gray-300 text-gray-600 text-sm leading-relaxed">
                      💡 {q.explanation}
                    </p>
                  </div>
                )}

                <button
                  onClick={handleNext}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-violet-700 to-violet-500 text-white font-bold text-base transition-all hover:shadow-xl hover:shadow-violet-500/30 btn-primary flex items-center justify-center gap-2"
                >
                  {currentIdx < questions.length - 1 ? (
                    <>Next Question <ChevronRight className="w-5 h-5" /></>
                  ) : (
                    <>Finish Quiz <Trophy className="w-5 h-5" /></>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Bottom padding */}
          <div className="h-6 safe-bottom" />
        </div>
      </div>
    );
  }

  // ——— FINISHED ———
  if (state === 'finished') {
    const isPerfect = finalCorrect === questions.length;

    return (
      <div className="min-h-screen dark:bg-[#0a0a0f] bg-[#f0f0f8] flex items-center justify-center px-4">
        {showConfetti && <Confetti />}

        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/3 w-[500px] h-[500px] bg-violet-900/15 blur-[120px] rounded-full" />
        </div>

        <div className="relative z-10 w-full max-w-md">
          <div className="glass-card rounded-3xl p-6 text-center animate-scale-in">
            {/* Result icon */}
            <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-4 ${
              isPerfect ? 'bg-yellow-500/20 border border-yellow-500/30 animate-glow'
              : accuracy >= 70 ? 'bg-green-500/20 border border-green-500/30'
              : 'bg-orange-500/20 border border-orange-500/30'
            }`}>
              <span className="text-4xl">
                {isPerfect ? '🏆' : accuracy >= 70 ? '🎯' : '💪'}
              </span>
            </div>

            <h1 className="font-display font-bold text-2xl dark:text-white text-gray-900 mb-1">
              {isPerfect ? 'Perfect Score!' : accuracy >= 70 ? 'Well Done!' : 'Keep Practicing!'}
            </h1>
            <p className="dark:text-gray-400 text-gray-500 text-sm mb-6">
              {quizSet?.title}
            </p>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              <div className="dark:bg-white/5 bg-gray-100 rounded-2xl p-4">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <Target className="w-4 h-4 text-cyan-400" />
                  <span className="dark:text-gray-400 text-gray-500 text-xs">Accuracy</span>
                </div>
                <div className="font-display font-bold text-3xl dark:text-white text-gray-900">{accuracy}%</div>
                <div className="dark:text-gray-400 text-gray-500 text-xs">{finalCorrect}/{questions.length} correct</div>
              </div>
              <div className="dark:bg-white/5 bg-gray-100 rounded-2xl p-4">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <Zap className="w-4 h-4 text-violet-400" />
                  <span className="dark:text-gray-400 text-gray-500 text-xs">XP Earned</span>
                </div>
                <div className="font-display font-bold text-3xl text-violet-400">+{totalXpEarned}</div>
                <div className="dark:text-gray-400 text-gray-500 text-xs">
                  {isPerfect ? '🎉 +50 perfect bonus!' : 'Keep going!'}
                </div>
              </div>
            </div>

            {/* Score breakdown */}
            <div className="dark:bg-white/3 bg-gray-100 rounded-2xl p-4 mb-5 text-left space-y-2">
              {answers.slice(0, 5).map((a, i) => (
                <div key={i} className="flex items-center gap-2">
                  {a.correct
                    ? <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                    : <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                  }
                  <span className="dark:text-gray-300 text-gray-600 text-xs truncate">
                    {questions[i]?.question}
                  </span>
                </div>
              ))}
              {answers.length > 5 && (
                <p className="dark:text-gray-500 text-gray-400 text-xs">+{answers.length - 5} more questions</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setAnswers([]);
                  setCurrentIdx(0);
                  setSelectedOption(null);
                  setIsAnswered(false);
                  setTotalScore(0);
                  setTotalXpEarned(0);
                  setShowConfetti(false);
                  startQuiz();
                }}
                className="flex-1 py-3 rounded-xl dark:bg-white/5 bg-gray-100 dark:text-gray-300 text-gray-600 font-medium text-sm transition-all dark:hover:bg-white/10 hover:bg-gray-200 flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Retry
              </button>
              <button
                onClick={() => router.push('/dashboard')}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-violet-700 to-violet-500 text-white font-bold text-sm transition-all btn-primary flex items-center justify-center gap-2"
              >
                <Home className="w-4 h-4" />
                Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
