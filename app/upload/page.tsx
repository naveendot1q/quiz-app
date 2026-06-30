'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useDropzone } from 'react-dropzone';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import {
  Upload, FileJson, CheckCircle, XCircle, Loader2,
  BookOpen, Tag, AlignLeft, ChevronRight,
  Eye, Trash2, Plus
} from 'lucide-react';

interface ParsedQuestion {
  q: string;
  options: string[];
  answer: number;
  explain?: string;
}

interface ParseResult {
  valid: boolean;
  questions: ParsedQuestion[];
  errors: string[];
}

function parseQuizJson(raw: string): ParseResult {
  const errors: string[] = [];
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { valid: false, questions: [], errors: ['Invalid JSON format'] };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { valid: false, questions: [], errors: ['JSON must be an object with a "questions" array'] };
  }

  if (!parsed.questions || !Array.isArray(parsed.questions)) {
    return { valid: false, questions: [], errors: ['JSON must have a "questions" array'] };
  }

  if (parsed.questions.length === 0) {
    return { valid: false, questions: [], errors: ['The "questions" array is empty — add at least one question'] };
  }

  const questions: ParsedQuestion[] = [];
  parsed.questions.forEach((q: any, i: number) => {
    const qErrors: string[] = [];

    if (!q || typeof q !== 'object' || Array.isArray(q)) {
      qErrors.push(`Q${i + 1}: must be an object, not ${Array.isArray(q) ? 'an array' : q === null ? 'null' : typeof q}`);
      errors.push(...qErrors);
      return;
    }

    if (!q.q || typeof q.q !== 'string') qErrors.push(`Q${i + 1}: missing "q" (question text)`);
    if (!Array.isArray(q.options) || q.options.length < 2) qErrors.push(`Q${i + 1}: "options" must have at least 2 items`);
    if (typeof q.answer !== 'number' || q.answer < 0) qErrors.push(`Q${i + 1}: "answer" must be a valid index number`);
    if (Array.isArray(q.options) && typeof q.answer === 'number' && q.answer >= q.options.length) qErrors.push(`Q${i + 1}: "answer" index out of range`);

    if (qErrors.length) {
      errors.push(...qErrors);
    } else {
      questions.push(q);
    }
  });

  return { valid: errors.length === 0 && questions.length > 0, questions, errors };
}

export default function UploadPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('General');
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push('/auth/login');
  }, [user, loading, router]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const f = acceptedFiles[0];
    if (!f) return;
    setFile(f);
    setSuccess(false);
    setParseResult(null);

    // Auto-fill title from filename
    const nameWithoutExt = f.name.replace(/\.json$/i, '').replace(/[-_]/g, ' ');
    setTitle(nameWithoutExt.charAt(0).toUpperCase() + nameWithoutExt.slice(1));

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const result = parseQuizJson(text);
      setParseResult(result);
    };
    reader.readAsText(f);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/json': ['.json'] },
    maxFiles: 1,
    maxSize: 5 * 1024 * 1024, // 5MB
  });

  const handleUpload = async () => {
    if (!parseResult?.valid || !user || !title.trim()) return;
    setUploading(true);

    // 1. Create quiz set
    const { data: quizSet, error: setError } = await supabase
      .from('quiz_sets')
      .insert({
        user_id: user.id,
        title: title.trim(),
        description: description.trim() || null,
        category,
        question_count: parseResult.questions.length,
      })
      .select()
      .single();

    if (setError || !quizSet) {
      setUploading(false);
      return;
    }

    // 2. Batch insert questions
    const questions = parseResult.questions.map(q => ({
      quiz_set_id: quizSet.id,
      user_id: user.id,
      question: q.q,
      options: q.options,
      correct_answer: q.answer,
      explanation: q.explain || null,
      difficulty: 'medium',
      points: 10,
    }));

    const BATCH = 100;
    for (let i = 0; i < questions.length; i += BATCH) {
      const batch = questions.slice(i, i + BATCH);
      await supabase.from('questions').insert(batch);
    }

    setUploading(false);
    setSuccess(true);

    setTimeout(() => router.push(`/quiz/${quizSet.id}`), 1500);
  };

  const reset = () => {
    setFile(null);
    setParseResult(null);
    setTitle('');
    setDescription('');
    setCategory('General');
    setSuccess(false);
    setPreview(false);
  };

  const categories = ['General', 'Science', 'Math', 'History', 'Technology', 'Language', 'Medicine', 'Law', 'Business', 'Art', 'Other'];

  return (
    <div className="min-h-screen dark:bg-[#0a0a0f] bg-[#f0f0f8] bg-grid">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 pt-20 pb-24">
        <div className="mb-8 pt-6">
          <h1 className="font-display font-bold text-3xl dark:text-white text-gray-900">Upload Quiz</h1>
          <p className="dark:text-gray-400 text-gray-500 mt-1">Import questions from a JSON file</p>
        </div>

        {/* JSON format reference */}
        <div className="glass-card rounded-2xl p-4 mb-5">
          <div className="flex items-center gap-2 mb-2">
            <FileJson className="w-4 h-4 text-violet-400" />
            <span className="dark:text-gray-300 text-gray-700 text-sm font-medium">Expected JSON format</span>
          </div>
          <pre className="dark:text-gray-400 text-gray-500 text-xs overflow-auto leading-relaxed">{`{
  "questions": [
    {
      "q": "Your question?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "answer": 0,
      "explain": "Why this answer is correct."
    }
  ]
}`}</pre>
        </div>

        {/* Dropzone */}
        {!file ? (
          <div
            {...getRootProps()}
            className={`glass-card rounded-2xl p-10 text-center cursor-pointer transition-all border-2 border-dashed ${
              isDragActive
                ? 'border-violet-500 dark:bg-violet-500/10 bg-violet-50'
                : 'dark:border-white/10 border-gray-300 dark:hover:border-violet-500/50 hover:border-violet-400'
            }`}
          >
            <input {...getInputProps()} />
            <div className="w-14 h-14 rounded-2xl dark:bg-white/5 bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <Upload className={`w-7 h-7 ${isDragActive ? 'text-violet-400' : 'dark:text-gray-400 text-gray-400'}`} />
            </div>
            <p className="dark:text-white text-gray-900 font-semibold mb-1">
              {isDragActive ? 'Drop it here!' : 'Drop your JSON file here'}
            </p>
            <p className="dark:text-gray-400 text-gray-500 text-sm">or click to browse · max 5MB</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* File info */}
            <div className="glass-card rounded-2xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-500/15 flex items-center justify-center shrink-0">
                <FileJson className="w-5 h-5 text-violet-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="dark:text-white text-gray-900 font-medium text-sm truncate">{file.name}</p>
                <p className="dark:text-gray-400 text-gray-500 text-xs">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
              <button onClick={reset} className="dark:text-gray-400 text-gray-400 hover:text-red-400 transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {/* Parse result */}
            {parseResult && (
              <div className={`rounded-2xl p-4 border ${
                parseResult.valid
                  ? 'bg-green-500/10 border-green-500/20'
                  : 'bg-red-500/10 border-red-500/20'
              }`}>
                <div className="flex items-center gap-2 mb-1">
                  {parseResult.valid
                    ? <CheckCircle className="w-4 h-4 text-green-400" />
                    : <XCircle className="w-4 h-4 text-red-400" />
                  }
                  <span className={`font-medium text-sm ${parseResult.valid ? 'text-green-400' : 'text-red-400'}`}>
                    {parseResult.valid
                      ? `${parseResult.questions.length} valid questions found`
                      : `${parseResult.errors.length} error(s) found`
                    }
                  </span>
                </div>
                {!parseResult.valid && (
                  <ul className="mt-2 space-y-0.5">
                    {parseResult.errors.slice(0, 5).map((err, i) => (
                      <li key={i} className="text-red-300 text-xs">• {err}</li>
                    ))}
                    {parseResult.errors.length > 5 && (
                      <li className="text-red-300 text-xs">...and {parseResult.errors.length - 5} more</li>
                    )}
                  </ul>
                )}
              </div>
            )}

            {/* Quiz details form */}
            {parseResult?.valid && (
              <div className="glass-card rounded-2xl p-5 space-y-4">
                <h3 className="font-display font-semibold dark:text-white text-gray-900 text-sm">Quiz Details</h3>

                <div>
                  <label className="block text-xs font-medium dark:text-gray-300 text-gray-700 mb-1.5">
                    Title <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <BookOpen className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 dark:text-gray-400 text-gray-400" />
                    <input
                      type="text"
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                      placeholder="Enter quiz title"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl dark:bg-white/5 bg-gray-100 dark:border-white/10 border-gray-200 border dark:text-white text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:border-violet-500 transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium dark:text-gray-300 text-gray-700 mb-1.5">Description</label>
                  <div className="relative">
                    <AlignLeft className="absolute left-3 top-3 w-4 h-4 dark:text-gray-400 text-gray-400" />
                    <textarea
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      placeholder="Optional description"
                      rows={2}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl dark:bg-white/5 bg-gray-100 dark:border-white/10 border-gray-200 border dark:text-white text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:border-violet-500 transition-colors resize-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium dark:text-gray-300 text-gray-700 mb-1.5">Category</label>
                  <div className="relative">
                    <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 dark:text-gray-400 text-gray-400" />
                    <select
                      value={category}
                      onChange={e => setCategory(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl dark:bg-[#1a1a26] bg-gray-100 dark:border-white/10 border-gray-200 border dark:text-white text-gray-900 text-sm focus:outline-none focus:border-violet-500 transition-colors appearance-none"
                    >
                      {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>

                {/* Preview toggle */}
                <button
                  onClick={() => setPreview(!preview)}
                  className="flex items-center gap-2 dark:text-gray-400 text-gray-500 hover:text-violet-400 text-sm transition-colors"
                >
                  <Eye className="w-4 h-4" />
                  {preview ? 'Hide' : 'Preview'} first 3 questions
                </button>

                {preview && (
                  <div className="space-y-3">
                    {parseResult.questions.slice(0, 3).map((q, i) => (
                      <div key={i} className="dark:bg-white/3 bg-gray-100 rounded-xl p-3">
                        <p className="dark:text-gray-200 text-gray-800 text-sm font-medium mb-2">
                          {i + 1}. {q.q}
                        </p>
                        <div className="space-y-1">
                          {q.options.map((opt, oi) => (
                            <p key={oi} className={`text-xs px-2 py-1 rounded-lg ${
                              oi === q.answer
                                ? 'dark:bg-green-500/15 bg-green-100 dark:text-green-400 text-green-600 font-medium'
                                : 'dark:text-gray-400 text-gray-500'
                            }`}>
                              {String.fromCharCode(65 + oi)}. {opt}
                            </p>
                          ))}
                        </div>
                      </div>
                    ))}
                    {parseResult.questions.length > 3 && (
                      <p className="dark:text-gray-500 text-gray-400 text-xs text-center">
                        +{parseResult.questions.length - 3} more questions
                      </p>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 pt-1">
                  <button
                    onClick={reset}
                    className="flex-1 py-2.5 rounded-xl dark:bg-white/5 bg-gray-100 dark:text-gray-300 text-gray-600 font-medium text-sm transition-all dark:hover:bg-white/10 hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleUpload}
                    disabled={uploading || !title.trim() || success}
                    className="flex-2 flex-grow flex items-center justify-center gap-2 py-2.5 px-5 rounded-xl bg-gradient-to-r from-violet-700 to-violet-500 text-white font-semibold text-sm transition-all hover:shadow-lg hover:shadow-violet-500/25 disabled:opacity-50 disabled:cursor-not-allowed btn-primary"
                  >
                    {success ? (
                      <>
                        <CheckCircle className="w-4 h-4 text-green-300" />
                        Uploaded! Redirecting...
                      </>
                    ) : uploading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        Create Quiz Set
                        <ChevronRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
