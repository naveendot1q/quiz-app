'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, XP_PERFECT_BONUS } from '@/lib/supabase';
import { format } from 'date-fns';
import {
  Shuffle, Loader2, Zap, CheckCircle, XCircle, ChevronRight,
  Trophy, Home, RotateCcw, Sparkles, Hash, BookOpen, Target
} from 'lucide-react';

type PageState = 'setup' | 'generating' | 'playing' | 'finished';

interface RandomQuestion {
  question: string;
  options: string[];
  answer: number;
  explanation: string;
}

interface SessionAnswer {
  selected: number;
  correct: boolean;
}

const QUESTION_COUNT_OPTIONS = [5, 10, 15, 20, 25];

const SUGGESTED_TOPICS = [
  'JavaScript', 'Python', 'World History', 'Human Biology',
  'Mathematics', 'Physics', 'English Grammar', 'Geography',
  'Computer Science', 'Chemistry', 'Economics', 'Philosophy',
];

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

  const [pageState, setPageState] = useState<PageState>('setup');
  const [topic, setTopic] = useState('');
  const [questionCount, setQuestionCount] = useState(10);
  const [questions, setQuestions] = useState<RandomQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [answers, setAnswers] = useState<SessionAnswer[]>([]);
  const [totalXp, setTotalXp] = useState(0);
  const [generateError, setGenerateError] = useState('');
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (!user) router.push('/auth/login');
  }, [user, router]);

  const generateQuestions = async () => {
    if (!topic.trim()) return;
    setGenerateError('');
    setPageState('generating');

    try {
      const prompt = `Generate exactly ${questionCount} multiple choice quiz questions about "${topic.trim()}".

Return ONLY a valid JSON array with no other text, markdown, or explanation. Each object must have exactly these fields:
{
  "question": "the question text",
  "options": ["option A", "option B", "option C", "option D"],
  "answer": 0,
  "explanation": "brief explanation of why the answer is correct"
}

The "answer" field is the zero-based index of the correct option.
Make questions varied in difficulty. Return exactly ${questionCount} questions.`;

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 4000,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!response.ok) throw new Error('API error');

      const data = await response.json();
      const rawText = data.content
        .filter((b: any) => b.type === 'text')
        .map((b: any) => b.text)
        .join('');

      // Parse JSON — strip any markdown fences
      const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed: RandomQuestion[] = JSON.parse(cleaned);

      // Validate structure
      const valid = parsed.filter(q =>
        q.question && Array.isArray(q.options) && q.options.length >= 2
        && typeof q.answer === 'number' && q.answer < q.options.length
      );

      if (valid.length === 0) throw new Error('No valid questions generated');

      setQuestions(valid);
      setCurrentIdx(0);
      setAnswers([]);
      setTotalXp(0);
      setPageState('playing');
    } catch (err) {
      setGenerateError('Failed to generate questions. Please try again with a different topic.');
      setPageState('setup');
    }
  };

  const handleAnswer = useCallback((optionIdx: number) => {
    if (isAnswered) return;
    const q = questions[currentIdx];
    const correct = optionIdx === q.answer;
    setSelectedOption(optionIdx);
    setIsAnswered(true);
    if (correct) setTotalXp(x => x + 10);
    setAnswers(prev => [...prev, { selected: optionIdx, correct }]);
  }, [isAnswered, questions, currentIdx]);

  const handleNext = useCallback(async () => {
    if (currentIdx < questions.length - 1) {
      setCurrentIdx(i => i + 1);
      setSelectedOption(null);
      setIsAnswered(false);
    } else {
      // Finish — save to DB and update profile
      const correctCount = [...answers, answers[answers.length - 1]].filter(a => a?.correct).length;
      const finalCorrect = answers.filter(a => a.correct).length + (isAnswered && selectedOption === questions[currentIdx].answer ? 1 : 0);
      const isPerfect = finalCorrect === questions.length;
      const bonusXp = isPerfect ? XP_PERFECT_BONUS : 0;
      const finalXp = totalXp + bonusXp;

      if (user) {
        // Save random session
        await supabase.from('random_quiz_sessions').insert({
          user_id: user.id,
          topic: topic.trim(),
          questions: questions,
          question_count: questions.length,
          completed: true,
          score: finalXp,
          correct_answers: finalCorrect,
          xp_earned: finalXp,
          completed_at: new Date().toISOString(),
        });

        // Update daily activity
        const today = format(new Date(), 'yyyy-MM-dd');
        await supabase.rpc('upsert_daily_activity', {
          p_user_id: user.id,
          p_date: today,
          p_questions: questions.length,
          p_correct: finalCorrect,
          p_xp: finalXp,
        });

        // Check streak
        await supabase.rpc('update_streak_after_activity', {
          p_user_id: user.id,
          p_date: today,
        });

        // Update profile XP
        if (profile) {
          await supabase.from('profiles').update({
            total_xp: profile.total_xp + finalXp,
            total_points: profile.total_points + finalXp,
            updated_at: new Date().toISOString(),
          }).eq('id', user.id);
        }

        await refreshProfile();
      }

      if (isPerfect) setShowConfetti(true);
      setTotalXp(finalXp);
      setPageState('finished');
    }
  }, [currentIdx, questions, answers, isAnswered, selectedOption, totalXp, user, topic, profile, refreshProfile]);

  useEffect(() => {
    if (pageState !== 'playing') return;
    const handler = (e: KeyboardEvent) => {
      if (e.key >= '1' && e.key <= '4') {
        const idx = parseInt(e.key) - 1;
        if (idx < questions[currentIdx]?.options.length) handleAnswer(idx);
      }
      if (e.key === 'Enter' && isAnswered) handleNext();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [pageState, isAnswered, currentIdx, questions, handleAnswer, handleNext]);

  const q = questions[currentIdx];
  const optionLabels = ['A', 'B', 'C', 'D'];
  const finalCorrect = answers.filter(a => a.correct).length;
  const accuracy = questions.length ? Math.round((finalCorrect / questions.length) * 100) : 0;
  const progress = questions.length ? (currentIdx / questions.length) * 100 : 0;

  // SETUP
  if (pageState === 'setup' || pageState === 'generating') {
    return (
      <div className="min-h-screen dark:bg-[#0a0a0f] bg-[#f0f0f8] flex items-center justify-center px-4">
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute top-1/3 right-1/3 w-[400px] h-[400px] bg-violet-900/15 blur-[120px] rounded-full" />
        </div>

        <div className="relative z-10 w-full max-w-md">
          <div className="glass-card rounded-3xl p-6">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-700 to-violet-900 flex items-center justify-center">
                <Shuffle className="w-5 h-5 text-violet-200" />
              </div>
              <div>
                <h1 className="font-display font-bold text-xl dark:text-white text-gray-900">Random Quiz</h1>
                <p className="dark:text-gray-400 text-gray-500 text-xs">AI-generated questions on any topic</p>
              </div>
            </div>

            {generateError && (
              <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {generateError}
              </div>
            )}

            {/* Topic input */}
            <div className="mb-4">
              <label className="block text-xs font-medium dark:text-gray-300 text-gray-700 mb-1.5">
                Topic or Subject
              </label>
              <div className="relative">
                <BookOpen className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 dark:text-gray-400 text-gray-400" />
                <input
                  type="text"
                  value={topic}
                  onChange={e => setTopic(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !pageState.includes('gen') && generateQuestions()}
                  placeholder="e.g. JavaScript, World War II, Human Biology..."
                  disabled={pageState === 'generating'}
                  className="w-full pl-10 pr-4 py-3 rounded-xl dark:bg-white/5 bg-gray-100 dark:border-white/10 border-gray-200 border dark:text-white text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:border-violet-500 transition-colors disabled:opacity-50"
                />
              </div>
            </div>

            {/* Suggested topics */}
            <div className="mb-5">
              <p className="text-xs dark:text-gray-500 text-gray-400 mb-2">Quick pick:</p>
              <div className="flex flex-wrap gap-1.5">
                {SUGGESTED_TOPICS.map(t => (
                  <button
                    key={t}
                    onClick={() => setTopic(t)}
                    disabled={pageState === 'generating'}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all disabled:opacity-50 ${
                      topic === t
                        ? 'bg-violet-600 text-white'
                        : 'dark:bg-white/5 bg-gray-100 dark:text-gray-400 text-gray-500 dark:hover:text-white hover:text-gray-900 dark:hover:bg-white/10 hover:bg-gray-200'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Question count */}
            <div className="mb-6">
              <label className="block text-xs font-medium dark:text-gray-300 text-gray-700 mb-1.5">
                <Hash className="inline w-3 h-3 mr-1" />
                Number of Questions
              </label>
              <div className="flex gap-2">
                {QUESTION_COUNT_OPTIONS.map(n => (
                  <button
                    key={n}
                    onClick={() => setQuestionCount(n)}
                    disabled={pageState === 'generating'}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-50 ${
                      questionCount === n
                        ? 'bg-gradient-to-r from-violet-700 to-violet-500 text-white shadow-lg shadow-violet-500/25'
                        : 'dark:bg-white/5 bg-gray-100 dark:text-gray-400 text-gray-600 dark:hover:bg-white/10 hover:bg-gray-200'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => router.push('/dashboard')}
                disabled={pageState === 'generating'}
                className="flex-1 py-3 rounded-xl dark:bg-white/5 bg-gray-100 dark:text-gray-300 text-gray-600 font-medium text-sm transition-all dark:hover:bg-white/10 hover:bg-gray-200 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Home className="w-4 h-4" />
                Back
              </button>
              <button
                onClick={generateQuestions}
                disabled={!topic.trim() || pageState === 'generating'}
                className="flex-2 flex-grow py-3 rounded-xl bg-gradient-to-r from-violet-700 to-violet-500 text-white font-bold text-sm transition-all hover:shadow-xl hover:shadow-violet-500/30 disabled:opacity-50 btn-primary flex items-center justify-center gap-2"
              >
                {pageState === 'generating' ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
                ) : (
                  <><Sparkles className="w-4 h-4" /> Generate Quiz</>
                )}
              </button>
            </div>

            {pageState === 'generating' && (
              <p className="text-center dark:text-gray-500 text-gray-400 text-xs mt-3">
                AI is crafting {questionCount} questions about "{topic}"…
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // PLAYING
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
              <Home className="w-4 h-4" />
            </button>

            <div className="flex-1 h-2 dark:bg-white/10 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full rounded-full progress-bar" style={{ width: `${progress}%` }} />
            </div>

            <span className="dark:text-gray-400 text-gray-500 text-xs font-mono shrink-0">
              {currentIdx + 1}/{questions.length}
            </span>

            <div className="flex items-center gap-1 dark:bg-violet-500/10 bg-violet-100 px-2.5 py-1 rounded-full shrink-0">
              <Zap className="w-3.5 h-3.5 text-violet-400" />
              <span className="text-violet-400 text-xs font-bold">{totalXp}</span>
            </div>
          </div>

          {/* Topic badge */}
          <div className="px-4 mb-3">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full dark:bg-violet-500/10 bg-violet-100 dark:border-violet-500/20 border-violet-200 border text-violet-400 text-xs font-medium">
              <Shuffle className="w-3 h-3" />
              {topic}
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
                } else if (idx === q.answer) {
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
                        : idx === q.answer ? 'bg-green-500 text-white'
                        : idx === selectedOption ? 'bg-red-500 text-white'
                        : 'dark:bg-white/5 bg-gray-200 dark:text-gray-500 text-gray-400'
                    }`}>
                      {isAnswered && idx === q.answer ? <CheckCircle className="w-4 h-4" />
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

  // FINISHED
  if (pageState === 'finished') {
    const isPerfect = finalCorrect === questions.length;
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
              <p className="text-violet-400 text-sm font-medium">{topic}</p>
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
                className="flex-1 py-3 rounded-xl dark:bg-white/5 bg-gray-100 dark:text-gray-300 text-gray-600 font-medium text-sm flex items-center justify-center gap-2"
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
