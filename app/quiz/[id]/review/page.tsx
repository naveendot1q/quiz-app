'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, Question, SessionAnswer } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import {
  CheckCircle, XCircle, ChevronLeft, Clock, Target,
  Zap, BookOpen, Loader2, Filter
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface ReviewSession {
  id: string;
  score: number;
  total_questions: number;
  correct_answers: number;
  xp_earned: number;
  time_taken: number;
  completed_at: string;
  answers: SessionAnswer[];
  quiz_sets: { title: string; category: string } | null;
}

type FilterType = 'all' | 'correct' | 'wrong';

export default function ReviewPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const quizSetId = params.id as string;

  const [session, setSession] = useState<ReviewSession | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  useEffect(() => {
    if (!loading && !user) { router.push('/auth/login'); return; }
    if (!user) return;

    async function loadData() {
      // Get the most recent completed session for this quiz set
      const { data: sessionData } = await supabase
        .from('quiz_sessions')
        .select('*, quiz_sets(title, category)')
        .eq('user_id', user!.id)
        .eq('quiz_set_id', quizSetId)
        .eq('completed', true)
        .order('completed_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!sessionData) {
        router.push('/dashboard');
        return;
      }

      setSession(sessionData);

      // Load all questions for this quiz set
      const { data: questionsData } = await supabase
        .from('questions')
        .select('*')
        .eq('quiz_set_id', quizSetId);

      if (questionsData) setQuestions(questionsData);
      setLoadingData(false);
    }

    loadData();
  }, [user, loading, quizSetId, router]);

  if (loading || loadingData) {
    return (
      <div className="min-h-screen dark:bg-[#0a0a0f] bg-[#f0f0f8] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
      </div>
    );
  }

  if (!session) return null;

  const answers = session.answers || [];
  const accuracy = session.total_questions
    ? Math.round((session.correct_answers / session.total_questions) * 100)
    : 0;

  // Build question-answer pairs using the order stored in answers array
  const reviewItems = answers.map((answer) => {
    const question = questions.find(q => q.id === answer.question_id);
    return { answer, question };
  }).filter(item => item.question !== undefined) as {
    answer: SessionAnswer;
    question: Question;
  }[];

  const filteredItems = reviewItems.filter(item => {
    if (filter === 'correct') return item.answer.correct;
    if (filter === 'wrong') return !item.answer.correct;
    return true;
  });

  return (
    <div className="min-h-screen dark:bg-[#0a0a0f] bg-[#f0f0f8]">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 pt-20 pb-24">

        {/* Back button */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 dark:text-gray-400 text-gray-500 hover:text-violet-400 text-sm font-medium transition-colors mt-6 mb-5"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>

        {/* Session header */}
        <div className="glass-card rounded-2xl p-5 mb-5">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-700 to-violet-900 flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5 text-violet-300" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="font-display font-bold text-lg dark:text-white text-gray-900 leading-tight">
                {session.quiz_sets?.title || 'Quiz Review'}
              </h1>
              <p className="dark:text-gray-400 text-gray-500 text-xs mt-0.5">
                {session.quiz_sets?.category} ·{' '}
                {formatDistanceToNow(new Date(session.completed_at), { addSuffix: true })}
              </p>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="dark:bg-white/5 bg-gray-100 rounded-xl p-3 text-center">
              <div className={`font-display font-bold text-xl ${
                accuracy >= 70 ? 'text-green-400' : accuracy >= 40 ? 'text-orange-400' : 'text-red-400'
              }`}>
                {accuracy}%
              </div>
              <div className="dark:text-gray-400 text-gray-500 text-xs flex items-center justify-center gap-1 mt-0.5">
                <Target className="w-3 h-3" /> Accuracy
              </div>
            </div>
            <div className="dark:bg-white/5 bg-gray-100 rounded-xl p-3 text-center">
              <div className="font-display font-bold text-xl text-violet-400">+{session.xp_earned}</div>
              <div className="dark:text-gray-400 text-gray-500 text-xs flex items-center justify-center gap-1 mt-0.5">
                <Zap className="w-3 h-3" /> XP Earned
              </div>
            </div>
            <div className="dark:bg-white/5 bg-gray-100 rounded-xl p-3 text-center">
              <div className="font-display font-bold text-xl dark:text-white text-gray-900">
                {Math.round(session.time_taken / 60)}m
              </div>
              <div className="dark:text-gray-400 text-gray-500 text-xs flex items-center justify-center gap-1 mt-0.5">
                <Clock className="w-3 h-3" /> Time
              </div>
            </div>
          </div>

          {/* Correct / wrong summary bar */}
          <div className="mt-4">
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-green-400 font-medium">✓ {session.correct_answers} correct</span>
              <span className="text-red-400 font-medium">✗ {session.total_questions - session.correct_answers} wrong</span>
            </div>
            <div className="h-2 rounded-full dark:bg-white/10 bg-gray-200 overflow-hidden flex">
              <div
                className="h-full bg-green-500 rounded-l-full transition-all"
                style={{ width: `${accuracy}%` }}
              />
              <div
                className="h-full bg-red-500 rounded-r-full transition-all"
                style={{ width: `${100 - accuracy}%` }}
              />
            </div>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 p-1 dark:bg-white/5 bg-gray-100 rounded-xl mb-4">
          {([
            { key: 'all', label: `All (${reviewItems.length})` },
            { key: 'correct', label: `✓ Correct (${reviewItems.filter(i => i.answer.correct).length})` },
            { key: 'wrong', label: `✗ Wrong (${reviewItems.filter(i => !i.answer.correct).length})` },
          ] as { key: FilterType; label: string }[]).map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
                filter === tab.key
                  ? 'dark:bg-[#1a1a26] bg-white dark:text-white text-gray-900 shadow-sm'
                  : 'dark:text-gray-400 text-gray-500 dark:hover:text-white hover:text-gray-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Question list */}
        <div className="space-y-3">
          {filteredItems.length === 0 && (
            <div className="glass-card rounded-2xl p-8 text-center">
              <p className="dark:text-gray-400 text-gray-500 text-sm">No questions match this filter.</p>
            </div>
          )}

          {filteredItems.map((item, idx) => {
            const { question: q, answer: a } = item;
            const isExpanded = expandedIdx === idx;
            const optionLabels = ['A', 'B', 'C', 'D', 'E'];

            return (
              <div
                key={q.id}
                className={`glass-card rounded-2xl overflow-hidden transition-all ${
                  a.correct
                    ? 'border-green-500/20'
                    : 'border-red-500/20'
                }`}
              >
                {/* Question row — always visible */}
                <button
                  className="w-full text-left px-4 py-4 flex items-start gap-3"
                  onClick={() => setExpandedIdx(isExpanded ? null : idx)}
                >
                  {/* Result icon */}
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                    a.correct ? 'bg-green-500/15' : 'bg-red-500/15'
                  }`}>
                    {a.correct
                      ? <CheckCircle className="w-4 h-4 text-green-400" />
                      : <XCircle className="w-4 h-4 text-red-400" />
                    }
                  </div>

                  {/* Question text + meta */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs dark:text-gray-500 text-gray-400">Q{idx + 1}</span>
                      {!a.correct && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 font-medium">Wrong</span>
                      )}
                      {a.correct && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 font-medium">Correct</span>
                      )}
                    </div>
                    <p className="dark:text-white text-gray-900 text-sm font-medium leading-snug line-clamp-2">
                      {q.question}
                    </p>
                    {!isExpanded && (
                      <p className="dark:text-gray-400 text-gray-500 text-xs mt-1">
                        Your answer: <span className={a.correct ? 'text-green-400' : 'text-red-400'}>
                          {optionLabels[a.selected]}. {q.options[a.selected]}
                        </span>
                      </p>
                    )}
                  </div>

                  {/* Expand chevron */}
                  <ChevronLeft className={`w-4 h-4 dark:text-gray-500 text-gray-400 shrink-0 transition-transform ${
                    isExpanded ? '-rotate-90' : 'rotate-180'
                  }`} />
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="px-4 pb-4 space-y-2 border-t dark:border-white/5 border-gray-100 pt-3">
                    {q.options.map((opt, oi) => {
                      const isCorrect = oi === q.correct_answer;
                      const isUserChoice = oi === a.selected;
                      const isWrongChoice = isUserChoice && !isCorrect;

                      let rowClass = 'flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm ';
                      if (isCorrect) {
                        rowClass += 'bg-green-500/10 border border-green-500/25';
                      } else if (isWrongChoice) {
                        rowClass += 'bg-red-500/10 border border-red-500/25';
                      } else {
                        rowClass += 'dark:bg-white/3 bg-gray-50 border border-transparent';
                      }

                      return (
                        <div key={oi} className={rowClass}>
                          {/* Option label bubble */}
                          <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                            isCorrect ? 'bg-green-500 text-white'
                            : isWrongChoice ? 'bg-red-500 text-white'
                            : 'dark:bg-white/10 bg-gray-200 dark:text-gray-400 text-gray-500'
                          }`}>
                            {optionLabels[oi]}
                          </span>

                          {/* Option text */}
                          <span className={`flex-1 ${
                            isCorrect ? 'text-green-400 font-medium'
                            : isWrongChoice ? 'text-red-400 font-medium'
                            : 'dark:text-gray-400 text-gray-500'
                          }`}>
                            {opt}
                          </span>

                          {/* Tags */}
                          <div className="flex gap-1 shrink-0">
                            {isCorrect && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/15 text-green-400 font-medium">
                                Correct
                              </span>
                            )}
                            {isUserChoice && !isCorrect && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 font-medium">
                                Your answer
                              </span>
                            )}
                            {isUserChoice && isCorrect && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/15 text-green-400 font-medium">
                                Your answer ✓
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {/* Explanation */}
                    {q.explanation && (
                      <div className="flex gap-2 px-3 py-2.5 rounded-xl dark:bg-violet-500/5 bg-violet-50 border dark:border-violet-500/15 border-violet-200 mt-1">
                        <span className="shrink-0 text-sm">💡</span>
                        <p className="dark:text-violet-300 text-violet-700 text-xs leading-relaxed">
                          {q.explanation}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
