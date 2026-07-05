'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, QuizSet, Question, XP_PERFECT_BONUS } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import { format } from 'date-fns';
import {
  Shuffle, Loader2, Zap, CheckCircle, XCircle, ChevronRight,
  Trophy, Home, RotateCcw, Hash, BookOpen, Target, X
} from 'lucide-react';

type PageState = 'setup' | 'loading' | 'playing' | 'finished';

interface SessionAnswer {
  selected: number;
  correct: boolean;
  question_id: string;
}

const QUESTION_COUNT_OPTIONS = [5, 10, 15, 20, 25];

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

export default function RandomQuizPage() {
  const { user, profile, refreshProfile } = useAuth();
  const router = useRouter();

  // Setup state
  const [quizSets, setQuizSets] = useState<QuizSet[]>([]);
  const [selectedSetId, setSelectedSetId] = useState<string>('all');
  const [questionCount, setQuestionCount] = useState(10);
  const [loadingSets, setLoadingSets] = useState(true);

  // Quiz state
  const [pageState, setPageState] = useState<PageState>('setup');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [answers, setAnswers] = useState<SessionAnswer[]>([]);
  const [totalXp, setTotalXp] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!user) { router.push('/auth/login'); return; }

    // Load user's quiz sets
    async function loadSets() {
      const { data } = await supabase
        .from('quiz_sets')
        .select('*')
        .eq('user_id', user!.id)
        .order('title');
      if (data) setQuizSets(data);
      setLoadingSets(false);
    }
    loadSets();
  }, [user, router]);

  // Compute available question count options based on selected set
  const selectedSet = quizSets.find(s => s.id === selectedSetId);
  const maxQuestions = selectedSetId === 'all'
    ? quizSets.reduce((sum, s) => sum + s.question_count, 0)
    : (selectedSet?.question_count || 0);

  const availableCountOptions = QUESTION_COUNT_OPTIONS.filter(n => n <= maxQuestions);
  // Always show at least one option — cap to maxQuestions if needed
  const effectiveCount = Math.min(questionCount, maxQuestions);

  const startRandomQuiz = async () => {
    if (!user) return;
    setErrorMsg('');
    setPageState('loading');

    try {
      let allQuestions: Question[] = [];

      if (selectedSetId === 'all') {
        // Pull questions from ALL user's quiz sets
        const { data } = await supabase
          .from('questions')
          .select('*')
          .eq('user_id', user.id);
        allQuestions = data || [];
      } else {
        // Pull questions from the selected quiz set only
        const { data } = await supabase
          .from('questions')
          .select('*')
          .eq('quiz_set_id', selectedSetId);
        allQuestions = data || [];
      }

      if (allQuestions.length === 0) {
        setErrorMsg('No questions found. Upload some questions first!');
        setPageState('setup');
        return;
      }

      // Shuffle and take the requested number
      const shuffled = [...allQuestions].sort(() => Math.random() - 0.5);
      const picked = shuffled.slice(0, Math.min(effectiveCount, shuffled.length));

      setQuestions(picked);
      setCurrentIdx(0);
      setAnswers([]);
      setTotalXp(0);
      setSelectedOption(null);
      setIsAnswered(false);
      setShowConfetti(false);
      setPageState('playing');
    } catch {
      setErrorMsg('Something went wrong. Please try again.');
      setPageState('setup');
    }
  };

  const handleAnswer = useCallback((optionIdx: number) => {
    if (isAnswered || pageState !== 'playing') return;
    const q = questions[currentIdx];
    const correct = optionIdx === q.correct_answer;
    setSelectedOption(optionIdx);
    setIsAnswered(true);
    if (correct) setTotalXp(x => x + q.points);
    setAnswers(prev => [...prev, { selected: optionIdx, correct, question_id: q.id }]);
  }, [isAnswered, pageState, questions, currentIdx]);

  const handleNext = useCallback(async () => {
    if (currentIdx < questions.length - 1) {
      setCurrentIdx(i => i + 1);
      setSelectedOption(null);
      setIsAnswered(false);
    } else {
      // Quiz done — save activity + update profile
      const finalCorrect = answers.filter(a => a.correct).length;
      const isPerfect = finalCorrect === questions.length;
      const bonusXp = isPerfect ? XP_PERFECT_BONUS : 0;
      const finalXp = totalXp + bonusXp;

      if (user && profile) {
        const today = format(new Date(), 'yyyy-MM-dd');

        await supabase.rpc('upsert_daily_activity', {
          p_user_id: user.id,
          p_date: today,
          p_questions: questions.length,
          p_correct: finalCorrect,
          p_xp: finalXp,
        });

        await supabase.rpc('update_streak_after_activity', {
          p_user_id: user.id,
          p_date: today,
        });

        await supabase.from('profiles').update({
          total_xp: profile.total_xp + finalXp,
          total_points: profile.total_points + finalXp,
          updated_at: new Date().toISOString(),
        }).eq('id', user.id);

        await refreshProfile();
      }

      setTotalXp(finalXp);
      if (isPerfect) setShowConfetti(true);
      setPageState('finished');
    }
  }, [currentIdx, questions, answers, totalXp, user, profile, refreshProfile]);

  // Keyboard shortcuts
  useEffect(() => {
    if (pageState !== 'playing') return;
    const handler = (e: KeyboardEvent) => {
      if (e.key >= '1' && e.key <= '4') {
        const idx = parseInt(e.key) - 1;
        if (idx < (questions[currentIdx]?.options.length || 0)) handleAnswer(idx);
      }
      if (e.key === 'Enter' && isAnswered) handleNext();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [pageState, isAnswered, currentIdx, questions, handleAnswer, handleNext]);

  const q = questions[currentIdx];
  const optionLabels = ['A', 'B', 'C', 'D', 'E'];
  const finalCorrect = answers.filter(a => a.correct).length;
  const accuracy = questions.length ? Math.round((finalCorrect / questions.length) * 100) : 0;
  const progress = questions.length ? (currentIdx / questions.length) * 100 : 0;

  // ─── SETUP ───────────────────────────────────────────────────────
  if (pageState === 'setup' || pageState === 'loading') {
    return (
      <div className="min-h-screen dark:bg-[#0a0a0f] bg-[#f0f0f8]">
        <Navbar />
        <div className="max-w-lg mx-auto px-4 pt-24 pb-16">

          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-700 to-violet-900 flex items-center justify-center">
              <Shuffle className="w-5 h-5 text-violet-200" />
            </div>
            <div>
              <h1 className="font-display font-bold text-xl dark:text-white text-gray-900">Random Quiz</h1>
              <p className="dark:text-gray-400 text-gray-500 text-xs">Shuffled questions from your uploads</p>
            </div>
          </div>

          {errorMsg && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {errorMsg}
            </div>
          )}

          <div className="glass-card rounded-2xl p-5 space-y-5">

            {/* Pick a quiz set / topic */}
            <div>
              <label className="block text-xs font-medium dark:text-gray-300 text-gray-700 mb-2">
                <BookOpen className="inline w-3.5 h-3.5 mr-1" />
                Pick a Topic
              </label>

              {loadingSets ? (
                <div className="flex items-center gap-2 dark:text-gray-400 text-gray-500 text-sm py-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading your quiz sets...
                </div>
              ) : quizSets.length === 0 ? (
                <div className="px-4 py-4 rounded-xl dark:bg-white/5 bg-gray-100 text-center">
                  <p className="dark:text-gray-400 text-gray-500 text-sm mb-3">
                    You haven't uploaded any quiz sets yet.
                  </p>
                  <button
                    onClick={() => router.push('/upload')}
                    className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-all"
                  >
                    Upload Questions
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* "All topics" option */}
                  <button
                    onClick={() => setSelectedSetId('all')}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all ${
                      selectedSetId === 'all'
                        ? 'border-violet-500 dark:bg-violet-500/10 bg-violet-50'
                        : 'dark:border-white/10 border-gray-200 dark:bg-white/3 bg-white dark:hover:border-violet-500/40 hover:border-violet-300'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      selectedSetId === 'all' ? 'bg-violet-600' : 'dark:bg-white/10 bg-gray-100'
                    }`}>
                      <Shuffle className={`w-4 h-4 ${selectedSetId === 'all' ? 'text-white' : 'dark:text-gray-400 text-gray-500'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium text-sm ${selectedSetId === 'all' ? 'text-violet-400' : 'dark:text-white text-gray-900'}`}>
                        All Topics (Mix)
                      </p>
                      <p className="dark:text-gray-400 text-gray-500 text-xs">
                        {quizSets.reduce((s, q) => s + q.question_count, 0)} questions across {quizSets.length} sets
                      </p>
                    </div>
                    {selectedSetId === 'all' && (
                      <CheckCircle className="w-4 h-4 text-violet-400 shrink-0" />
                    )}
                  </button>

                  {/* Individual quiz sets */}
                  {quizSets.map(set => (
                    <button
                      key={set.id}
                      onClick={() => setSelectedSetId(set.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all ${
                        selectedSetId === set.id
                          ? 'border-violet-500 dark:bg-violet-500/10 bg-violet-50'
                          : 'dark:border-white/10 border-gray-200 dark:bg-white/3 bg-white dark:hover:border-violet-500/40 hover:border-violet-300'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        selectedSetId === set.id ? 'bg-violet-600' : 'dark:bg-white/10 bg-gray-100'
                      }`}>
                        <BookOpen className={`w-4 h-4 ${selectedSetId === set.id ? 'text-white' : 'dark:text-gray-400 text-gray-500'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`font-medium text-sm truncate ${selectedSetId === set.id ? 'text-violet-400' : 'dark:text-white text-gray-900'}`}>
                          {set.title}
                        </p>
                        <p className="dark:text-gray-400 text-gray-500 text-xs">
                          {set.question_count} questions · {set.category}
                        </p>
                      </div>
                      {selectedSetId === set.id && (
                        <CheckCircle className="w-4 h-4 text-violet-400 shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Number of questions */}
            {quizSets.length > 0 && maxQuestions > 0 && (
              <div>
                <label className="block text-xs font-medium dark:text-gray-300 text-gray-700 mb-2">
                  <Hash className="inline w-3.5 h-3.5 mr-1" />
                  Number of Questions
                  <span className="dark:text-gray-500 text-gray-400 font-normal ml-1">
                    (max {maxQuestions} available)
                  </span>
                </label>
                <div className="flex gap-2 flex-wrap">
                  {availableCountOptions.length > 0 ? (
                    availableCountOptions.map(n => (
                      <button
                        key={n}
                        onClick={() => setQuestionCount(n)}
                        className={`flex-1 min-w-[48px] py-2.5 rounded-xl text-sm font-bold transition-all ${
                          questionCount === n || (questionCount > maxQuestions && n === availableCountOptions[availableCountOptions.length - 1])
                            ? 'bg-gradient-to-r from-violet-700 to-violet-500 text-white shadow-lg shadow-violet-500/25'
                            : 'dark:bg-white/5 bg-gray-100 dark:text-gray-400 text-gray-600 dark:hover:bg-white/10 hover:bg-gray-200'
                        }`}
                      >
                        {n}
                      </button>
                    ))
                  ) : (
                    // If fewer than 5 questions, just show "All X"
                    <button
                      className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r from-violet-700 to-violet-500 text-white"
                    >
                      All {maxQuestions}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Start button */}
            {quizSets.length > 0 && (
              <button
                onClick={startRandomQuiz}
                disabled={pageState === 'loading' || maxQuestions === 0}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-violet-700 to-violet-500 text-white font-bold text-sm transition-all hover:shadow-xl hover:shadow-violet-500/30 disabled:opacity-50 btn-primary flex items-center justify-center gap-2"
              >
                {pageState === 'loading' ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Loading questions...</>
                ) : (
                  <><Shuffle className="w-4 h-4" /> Start Random Quiz</>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── PLAYING ─────────────────────────────────────────────────────
  if (pageState === 'playing' && q) {
    return (
      <div className="quiz-fullscreen dark:bg-[#0a0a0f] bg-[#f0f0f8] quiz-content">
        <div className="min-h-screen flex flex-col">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 pt-4 pb-3">
            <button
              onClick={() => setPageState('setup')}
              className="w-8 h-8 rounded-lg dark:bg-white/5 bg-gray-200 flex items-center justify-center dark:text-gray-400 text-gray-500 hover:text-red-400 transition-all shrink-0"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex-1 h-2 dark:bg-white/10 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full rounded-full progress-bar" style={{ width: `${progress}%` }} />
            </div>

            <span className="dark:text-gray-400 text-gray-500 text-sm font-mono shrink-0">
              {currentIdx + 1}/{questions.length}
            </span>

            <div className="flex items-center gap-1 dark:bg-violet-500/10 bg-violet-100 px-2.5 py-1 rounded-full shrink-0">
              <Zap className="w-3.5 h-3.5 text-violet-400" />
              <span className="text-violet-400 text-xs font-bold">{totalXp}</span>
            </div>
          </div>

          {/* Topic badge */}
          <div className="px-4 mb-3">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full dark:bg-violet-500/10 bg-violet-100 dark:border-violet-500/20 border-violet-200 border text-violet-400 text-xs font-medium">
              <Shuffle className="w-3 h-3" />
              {selectedSetId === 'all' ? 'All Topics Mix' : (quizSets.find(s => s.id === selectedSetId)?.title || 'Random')}
            </span>
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
                    onClick={() => handleAnswer(idx)}
                    disabled={isAnswered}
                  >
                    <span className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 transition-all ${
                      !isAnswered ? 'dark:bg-white/10 bg-gray-100 dark:text-gray-300 text-gray-600'
                        : idx === q.correct_answer ? 'bg-green-500 text-white'
                        : idx === selectedOption ? 'bg-red-500 text-white'
                        : 'dark:bg-white/5 bg-gray-200 dark:text-gray-500 text-gray-400'
                    }`}>
                      {isAnswered && idx === q.correct_answer ? <CheckCircle className="w-4 h-4" />
                        : isAnswered && idx === selectedOption ? <XCircle className="w-4 h-4" />
                        : optionLabels[idx]}
                    </span>
                    <span className="text-sm leading-snug">{opt}</span>
                  </button>
                );
              })}
            </div>

            {isAnswered && (
              <div className="mt-5 space-y-3 animate-slide-up">
                {q.explanation && (
                  <div className="px-4 py-3 rounded-2xl dark:bg-white/5 bg-gray-100 dark:border-white/10 border-gray-200 border">
                    <p className="dark:text-gray-300 text-gray-600 text-sm leading-relaxed">💡 {q.explanation}</p>
                  </div>
                )}
                <button
                  onClick={handleNext}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-violet-700 to-violet-500 text-white font-bold text-base transition-all hover:shadow-xl hover:shadow-violet-500/30 btn-primary flex items-center justify-center gap-2"
                >
                  {currentIdx < questions.length - 1
                    ? <><ChevronRight className="w-5 h-5" /> Next Question</>
                    : <><Trophy className="w-5 h-5" /> Finish Quiz</>}
                </button>
              </div>
            )}
          </div>
          <div className="h-6" />
        </div>
      </div>
    );
  }

  // ─── FINISHED ────────────────────────────────────────────────────
  if (pageState === 'finished') {
    const isPerfect = finalCorrect === questions.length;
    const topicLabel = selectedSetId === 'all'
      ? 'All Topics Mix'
      : (quizSets.find(s => s.id === selectedSetId)?.title || 'Random');

    return (
      <div className="min-h-screen dark:bg-[#0a0a0f] bg-[#f0f0f8] flex items-center justify-center px-4">
        {showConfetti && <Confetti />}
        <div className="relative z-10 w-full max-w-md">
          <div className="glass-card rounded-3xl p-6 text-center animate-scale-in">
            <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-4 ${
              isPerfect ? 'bg-yellow-500/20 border border-yellow-500/30'
              : accuracy >= 70 ? 'bg-green-500/20 border border-green-500/30'
              : 'bg-orange-500/20 border border-orange-500/30'
            }`}>
              <span className="text-4xl">{isPerfect ? '🏆' : accuracy >= 70 ? '🎯' : '💪'}</span>
            </div>

            <h1 className="font-display font-bold text-2xl dark:text-white text-gray-900 mb-1">
              {isPerfect ? 'Perfect Score!' : accuracy >= 70 ? 'Well Done!' : 'Keep Practicing!'}
            </h1>
            <div className="flex items-center justify-center gap-1.5 mb-5">
              <Shuffle className="w-4 h-4 text-violet-400" />
              <p className="text-violet-400 text-sm font-medium">{topicLabel}</p>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-5">
              <div className="dark:bg-white/5 bg-gray-100 rounded-2xl p-4">
                <Target className="w-4 h-4 text-cyan-400 mx-auto mb-1" />
                <div className="font-display font-bold text-3xl dark:text-white text-gray-900">{accuracy}%</div>
                <div className="dark:text-gray-400 text-gray-500 text-xs">{finalCorrect}/{questions.length} correct</div>
              </div>
              <div className="dark:bg-white/5 bg-gray-100 rounded-2xl p-4">
                <Zap className="w-4 h-4 text-violet-400 mx-auto mb-1" />
                <div className="font-display font-bold text-3xl text-violet-400">+{totalXp}</div>
                <div className="dark:text-gray-400 text-gray-500 text-xs">{isPerfect ? '🎉 +50 bonus!' : 'XP earned'}</div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setAnswers([]);
                  setCurrentIdx(0);
                  setSelectedOption(null);
                  setIsAnswered(false);
                  setTotalXp(0);
                  setShowConfetti(false);
                  setPageState('setup');
                }}
                className="flex-1 py-3 rounded-xl dark:bg-white/5 bg-gray-100 dark:text-gray-300 text-gray-600 font-medium text-sm flex items-center justify-center gap-2 transition-all dark:hover:bg-white/10"
              >
                <RotateCcw className="w-4 h-4" />
                New Quiz
              </button>
              <button
                onClick={() => router.push('/dashboard')}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-violet-700 to-violet-500 text-white font-bold text-sm btn-primary flex items-center justify-center gap-2"
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
