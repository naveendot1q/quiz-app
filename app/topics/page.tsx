'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, QuizSet } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import {
  Plus, Pencil, Trash2, X, BookOpen, Loader2,
  ChevronRight, Search, Tag, AlignLeft, Save
} from 'lucide-react';

const CATEGORIES = [
  'General', 'Science', 'Math', 'History', 'Technology',
  'Language', 'Medicine', 'Law', 'Business', 'Art', 'Other'
];

interface EditState {
  id: string | null; // null = creating new
  title: string;
  description: string;
  category: string;
}

export default function TopicsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [quizSets, setQuizSets] = useState<QuizSet[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [search, setSearch] = useState('');

  // Edit / create panel
  const [editState, setEditState] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loading && !user) router.push('/auth/login');
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    loadSets();
  }, [user]);

  async function loadSets() {
    setLoadingData(true);
    const { data } = await supabase
      .from('quiz_sets')
      .select('*')
      .eq('user_id', user!.id)
      .order('updated_at', { ascending: false });
    if (data) setQuizSets(data);
    setLoadingData(false);
  }

  // Open edit panel for existing set
  function openEdit(set: QuizSet) {
    setEditState({
      id: set.id,
      title: set.title,
      description: set.description || '',
      category: set.category,
    });
    setDeleteConfirmId(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  // Open create panel (blank)
  function openCreate() {
    setEditState({ id: null, title: '', description: '', category: 'General' });
    setDeleteConfirmId(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function closePanel() {
    setEditState(null);
    setDeleteConfirmId(null);
  }

  async function handleSave() {
    if (!editState || !editState.title.trim() || !user) return;
    setSaving(true);

    if (editState.id) {
      // Update existing
      const { data } = await supabase
        .from('quiz_sets')
        .update({
          title: editState.title.trim(),
          description: editState.description.trim() || null,
          category: editState.category,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editState.id)
        .select()
        .single();

      if (data) {
        setQuizSets(prev => prev.map(s => s.id === editState.id ? data : s));
      }
    } else {
      // Create new (empty quiz set — user uploads questions separately)
      const { data } = await supabase
        .from('quiz_sets')
        .insert({
          user_id: user.id,
          title: editState.title.trim(),
          description: editState.description.trim() || null,
          category: editState.category,
          question_count: 0,
        })
        .select()
        .single();

      if (data) {
        setQuizSets(prev => [data, ...prev]);
      }
    }

    setSaving(false);
    closePanel();
  }

  async function handleDelete(setId: string) {
    setDeleting(true);
    // Delete questions first (cascade should handle it but be explicit)
    await supabase.from('questions').delete().eq('quiz_set_id', setId);
    await supabase.from('quiz_sets').delete().eq('id', setId);
    setQuizSets(prev => prev.filter(s => s.id !== setId));
    setDeleting(false);
    setDeleteConfirmId(null);
  }

  const filtered = quizSets.filter(s =>
    s.title.toLowerCase().includes(search.toLowerCase()) ||
    s.category.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen dark:bg-[#0a0a0f] bg-[#f0f0f8] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen dark:bg-[#0a0a0f] bg-[#f0f0f8]">
      <Navbar />

      <div className="max-w-2xl mx-auto px-4 pt-20 pb-24">
        {/* Header */}
        <div className="flex items-center justify-between mt-6 mb-5">
          <div>
            <h1 className="font-display font-bold text-2xl dark:text-white text-gray-900">My Topics</h1>
            <p className="dark:text-gray-400 text-gray-500 text-sm mt-0.5">
              {quizSets.length} quiz set{quizSets.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-700 to-violet-500 text-white font-semibold text-sm transition-all hover:shadow-lg hover:shadow-violet-500/25 btn-primary"
          >
            <Plus className="w-4 h-4" />
            New Topic
          </button>
        </div>

        {/* Create / Edit panel */}
        {editState !== null && (
          <div className="glass-card rounded-2xl p-5 mb-5 border border-violet-500/30 animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-semibold dark:text-white text-gray-900 text-sm">
                {editState.id ? 'Edit Topic' : 'Create New Topic'}
              </h2>
              <button
                onClick={closePanel}
                className="w-7 h-7 rounded-lg dark:bg-white/5 bg-gray-100 flex items-center justify-center dark:text-gray-400 text-gray-500 hover:text-red-400 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-3">
              {/* Title */}
              <div>
                <label className="block text-xs font-medium dark:text-gray-300 text-gray-700 mb-1.5">
                  Title <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <BookOpen className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 dark:text-gray-400 text-gray-400" />
                  <input
                    ref={inputRef}
                    type="text"
                    value={editState.title}
                    onChange={e => setEditState(s => s ? { ...s, title: e.target.value } : s)}
                    onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') closePanel(); }}
                    placeholder="e.g. World History, JavaScript, Biology..."
                    maxLength={80}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl dark:bg-white/5 bg-gray-100 dark:border-white/10 border-gray-200 border dark:text-white text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:border-violet-500 transition-colors"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-medium dark:text-gray-300 text-gray-700 mb-1.5">
                  Description <span className="dark:text-gray-500 text-gray-400 font-normal">(optional)</span>
                </label>
                <div className="relative">
                  <AlignLeft className="absolute left-3 top-3 w-4 h-4 dark:text-gray-400 text-gray-400" />
                  <textarea
                    value={editState.description}
                    onChange={e => setEditState(s => s ? { ...s, description: e.target.value } : s)}
                    placeholder="Brief description of this topic..."
                    rows={2}
                    maxLength={200}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl dark:bg-white/5 bg-gray-100 dark:border-white/10 border-gray-200 border dark:text-white text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:border-violet-500 transition-colors resize-none"
                  />
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-medium dark:text-gray-300 text-gray-700 mb-1.5">
                  Category
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat}
                      onClick={() => setEditState(s => s ? { ...s, category: cat } : s)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        editState.category === cat
                          ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/20'
                          : 'dark:bg-white/5 bg-gray-100 dark:text-gray-400 text-gray-500 dark:hover:text-white hover:text-gray-900 dark:hover:bg-white/10 hover:bg-gray-200'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Note for new topics */}
              {!editState.id && (
                <p className="text-xs dark:text-gray-500 text-gray-400 bg-violet-500/5 rounded-lg px-3 py-2 border dark:border-violet-500/10 border-violet-200">
                  💡 After creating the topic, go to <strong>Upload</strong> to add questions to it.
                </p>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={closePanel}
                  className="flex-1 py-2.5 rounded-xl dark:bg-white/5 bg-gray-100 dark:text-gray-300 text-gray-600 font-medium text-sm transition-all dark:hover:bg-white/10 hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !editState.title.trim()}
                  className="flex-2 flex-grow py-2.5 rounded-xl bg-gradient-to-r from-violet-700 to-violet-500 text-white font-semibold text-sm transition-all disabled:opacity-50 btn-primary flex items-center justify-center gap-2"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {saving ? 'Saving...' : editState.id ? 'Save Changes' : 'Create Topic'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Search */}
        {quizSets.length > 3 && (
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 dark:text-gray-400 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search topics..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl dark:bg-white/5 bg-gray-100 dark:border-white/10 border-gray-200 border dark:text-white text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:border-violet-500 transition-colors"
            />
          </div>
        )}

        {/* List */}
        {loadingData ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="glass-card rounded-2xl p-4 animate-pulse">
                <div className="h-4 dark:bg-white/5 bg-gray-200 rounded w-1/2 mb-2" />
                <div className="h-3 dark:bg-white/5 bg-gray-200 rounded w-1/4" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="glass-card rounded-2xl p-10 text-center">
            <BookOpen className="w-10 h-10 dark:text-gray-600 text-gray-300 mx-auto mb-3" />
            <p className="dark:text-gray-300 text-gray-700 font-medium mb-1">
              {search ? 'No topics match your search' : 'No topics yet'}
            </p>
            <p className="dark:text-gray-500 text-gray-400 text-sm mb-4">
              {search ? 'Try a different search term' : 'Create your first topic to get started'}
            </p>
            {!search && (
              <button
                onClick={openCreate}
                className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-medium text-sm transition-all"
              >
                Create Topic
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(set => {
              const isEditing = editState?.id === set.id;
              const isDeleteConfirm = deleteConfirmId === set.id;

              return (
                <div
                  key={set.id}
                  className={`glass-card rounded-2xl transition-all ${
                    isEditing ? 'border-violet-500/40' : ''
                  }`}
                >
                  <div className="flex items-center gap-3 px-4 py-3.5">
                    {/* Icon */}
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-700 to-violet-900 flex items-center justify-center shrink-0">
                      <BookOpen className="w-4 h-4 text-violet-300" />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0" onClick={() => !isDeleteConfirm && router.push(`/quiz/${set.id}`)}>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold dark:text-white text-gray-900 text-sm truncate cursor-pointer hover:text-violet-400 transition-colors">
                          {set.title}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="inline-flex items-center gap-1 text-[10px] dark:text-gray-500 text-gray-400">
                          <Tag className="w-2.5 h-2.5" />
                          {set.category}
                        </span>
                        <span className="text-[10px] dark:text-gray-500 text-gray-400">·</span>
                        <span className="text-[10px] dark:text-gray-500 text-gray-400">
                          {set.question_count} question{set.question_count !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    {!isDeleteConfirm ? (
                      <div className="flex items-center gap-1 shrink-0">
                        {/* Go to quiz */}
                        <button
                          onClick={() => router.push(`/quiz/${set.id}`)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center dark:text-gray-400 text-gray-400 dark:hover:text-violet-400 hover:text-violet-500 dark:hover:bg-white/5 hover:bg-gray-100 transition-all"
                          title="Start quiz"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>

                        {/* Edit */}
                        <button
                          onClick={() => isEditing ? closePanel() : openEdit(set)}
                          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                            isEditing
                              ? 'bg-violet-600 text-white'
                              : 'dark:text-gray-400 text-gray-400 dark:hover:text-violet-400 hover:text-violet-500 dark:hover:bg-white/5 hover:bg-gray-100'
                          }`}
                          title="Edit topic"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete */}
                        <button
                          onClick={() => setDeleteConfirmId(set.id)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center dark:text-gray-400 text-gray-400 hover:text-red-400 dark:hover:bg-white/5 hover:bg-gray-100 transition-all"
                          title="Delete topic"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      /* Delete confirm inline */
                      <div className="flex items-center gap-2 shrink-0 animate-scale-in">
                        <span className="text-xs dark:text-gray-400 text-gray-500 hidden sm:block">Delete?</span>
                        <button
                          onClick={() => handleDelete(set.id)}
                          disabled={deleting}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-semibold transition-all disabled:opacity-50"
                        >
                          {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                          Yes
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(null)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg dark:bg-white/5 bg-gray-100 dark:text-gray-300 text-gray-600 text-xs font-medium transition-all"
                        >
                          <X className="w-3 h-3" />
                          No
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
