import { useEffect, useState, useRef, useCallback } from 'react';
import { ChevronRight, ChevronLeft, Flag, AlertTriangle, Check, FileText, Clock, Video, Upload } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { navigate } from '@/hooks/useRouter';
import { fetchExamById } from '@/services/examService';
import { useRecording } from '@/hooks/useRecording';
import { useToast } from '@/components/Toast';
import {
  fetchAttemptByStudentExam,
  fetchExamQuestions,
  fetchAttemptAnswers,
  saveAnswer,
  submitAndGradeAttempt,
  hasAttemptBeenSubmitted,
  isAttemptExpired,
} from '@/services/attemptService';
import type { Student, Exam, StudentQuestion, Answer, CorrectAnswer, ExamAttempt } from '@/types';

interface ExamRunnerPageProps {
  examId: string;
}

const CHOICES: { key: CorrectAnswer; label: string }[] = [
  { key: 'A', label: 'A' },
  { key: 'B', label: 'B' },
  { key: 'C', label: 'C' },
  { key: 'D', label: 'D' },
];

function formatTime(seconds: number): string {
  if (seconds < 0) seconds = 0;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function readAnswerDraft(attemptId: string): Record<string, CorrectAnswer> {
  const key = `saifquiz_answers_${attemptId}`;
  const stored = localStorage.getItem(key);
  if (!stored) return {};

  let parsed: unknown;
  try {
    parsed = JSON.parse(stored);
  } catch {
    localStorage.removeItem(key);
    return {};
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
  return Object.fromEntries(
    Object.entries(parsed).filter(
      (entry): entry is [string, CorrectAnswer] =>
        entry[1] === 'A' || entry[1] === 'B' || entry[1] === 'C' || entry[1] === 'D'
    )
  );
}

function writeAnswerDraft(attemptId: string, draft: Record<string, CorrectAnswer>): void {
  const key = `saifquiz_answers_${attemptId}`;
  if (Object.keys(draft).length === 0) {
    localStorage.removeItem(key);
  } else {
    localStorage.setItem(key, JSON.stringify(draft));
  }
}

async function persistAnswerDraft(attemptId: string): Promise<void> {
  const draft = readAnswerDraft(attemptId);
  const pending = Object.entries(draft);
  const results = await Promise.allSettled(
    pending.map(([questionId, answer]) => saveAnswer(attemptId, questionId, answer))
  );
  if (results.some((result) => result.status === 'rejected')) {
    throw new Error('تعذّر حفظ جميع الإجابات. تحقق من الاتصال ثم أعد المحاولة');
  }

  const latestDraft = readAnswerDraft(attemptId);
  pending.forEach(([questionId, answer]) => {
    if (latestDraft[questionId] === answer) delete latestDraft[questionId];
  });
  writeAnswerDraft(attemptId, latestDraft);
}

export function ExamRunnerPage({ examId }: ExamRunnerPageProps) {
  const { showToast } = useToast();
  const [exam, setExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<StudentQuestion[]>([]);
  const [attempt, setAttempt] = useState<ExamAttempt | null>(null);
  const [answers, setAnswers] = useState<Map<string, CorrectAnswer>>(new Map());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submissionCompleted, setSubmissionCompleted] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [showFiveMinWarning, setShowFiveMinWarning] = useState(false);
  const timerEnabled = remainingSeconds !== null && !alreadySubmitted && !loading;

  // Refs for exit handling
  const answersRef = useRef<Map<string, CorrectAnswer>>(new Map());
  const attemptRef = useRef<ExamAttempt | null>(null);
  const submittedRef = useRef(false);

  // Recording hook — enabled once we have an attempt
  const recording = useRecording({
    examId,
    attemptId: attempt?.id ?? null,
    enabled: !!attempt && !alreadySubmitted,
  });

  // Keep refs in sync
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    attemptRef.current = attempt;
  }, [attempt]);

  // Load exam data
  useEffect(() => {
    const stored = sessionStorage.getItem('saifquiz_student');
    if (!stored) {
      navigate('/');
      return;
    }
    const s = JSON.parse(stored) as Student;

    (async () => {
      try {
        const [found, existingAttempt] = await Promise.all([
          fetchExamById(examId),
          fetchAttemptByStudentExam(s.id, examId),
        ]);
        if (!found) {
          setError('هذا الامتحان غير متاح حالياً');
          setLoading(false);
          return;
        }
        setExam(found);

        if (!existingAttempt) {
          setError('لم يتم بدء هذا الامتحان بعد');
          setLoading(false);
          return;
        }
        if (hasAttemptBeenSubmitted(existingAttempt.status)) {
          setAlreadySubmitted(true);
          setAttempt(existingAttempt);
          setLoading(false);
          return;
        }
        if (isAttemptExpired(existingAttempt, found.end_at)) {
          submittedRef.current = true;
          try {
            await submitAndGradeAttempt(existingAttempt.id, 'auto_submitted');
          } catch (err) {
            submittedRef.current = false;
            setError(
              err instanceof Error
                ? `انتهى الوقت، لكن تعذّر تسليم الامتحان: ${err.message}`
                : 'انتهى الوقت، لكن تعذّر تسليم الامتحان. تحقق من الاتصال وأعد المحاولة'
            );
            setLoading(false);
            return;
          }
          setAlreadySubmitted(true);
          setAttempt(existingAttempt);
          setLoading(false);
          return;
        }

        setAttempt(existingAttempt);

        const expiresAt = existingAttempt.expires_at ?? found.end_at;
        if (expiresAt) {
          const remaining = Math.floor(
            (new Date(expiresAt).getTime() - Date.now()) / 1000
          );
          setRemainingSeconds(remaining > 0 ? remaining : 0);
        }

        const [qs, existingAnswers] = await Promise.all([
          fetchExamQuestions(examId),
          fetchAttemptAnswers(existingAttempt.id),
        ]);

        setQuestions(qs);

        const answerMap = new Map<string, CorrectAnswer>();
        existingAnswers.forEach((a: Answer) => {
          if (a.selected_answer) {
            answerMap.set(a.question_id, a.selected_answer);
          }
        });
        const questionIds = new Set(qs.map((question) => question.id));
        Object.entries(readAnswerDraft(existingAttempt.id)).forEach(([questionId, answer]) => {
          if (questionIds.has(questionId)) answerMap.set(questionId, answer);
        });
        setAnswers(answerMap);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'حدث خطأ أثناء تحميل الامتحان');
      } finally {
        setLoading(false);
      }
    })();
  }, [examId]);

  // Start recording once attempt is loaded and exam is active
  useEffect(() => {
    if (!attempt || alreadySubmitted || loading) return;
    let cancelled = false;

    (async () => {
      const granted = await recording.requestPermissions();
      if (cancelled || !granted) return;
      await recording.startRecording();
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt?.id, alreadySubmitted, loading]);

  // Timer countdown
  useEffect(() => {
    if (!timerEnabled) return;

    const interval = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev === null || prev <= 0) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timerEnabled]);

  useEffect(() => {
    const activeAttemptId = attempt?.id;
    if (!activeAttemptId || questions.length === 0) return;
    const questionIds = new Set(questions.map((question) => question.id));

    const syncPendingAnswers = async () => {
      const draft = readAnswerDraft(activeAttemptId);
      const pending = Object.entries(draft).filter(([questionId]) => questionIds.has(questionId));
      if (pending.length === 0) return;

      setSaving(true);
      try {
        await persistAnswerDraft(activeAttemptId);
      } catch {
        showToast('بعض الإجابات ما زالت بانتظار الاتصال. سيعاد حفظها تلقائياً.', 'error');
      } finally {
        setSaving(false);
      }
    };

    window.addEventListener('online', syncPendingAnswers);
    if (navigator.onLine) void syncPendingAnswers();
    return () => window.removeEventListener('online', syncPendingAnswers);
  }, [attempt?.id, questions, showToast]);

  // Five-minute warning
  useEffect(() => {
    if (remainingSeconds !== null && remainingSeconds > 0 && remainingSeconds <= 300 && !showFiveMinWarning) {
      setShowFiveMinWarning(true);
    }
  }, [remainingSeconds, showFiveMinWarning]);

  // Auto-submit on timer expiry
  const stopRecordingAndUpload = recording.stopAndUpload;
  const finishSubmission = useCallback(async (status: 'submitted' | 'auto_submitted') => {
    const currentAttempt = attemptRef.current;
    if (!currentAttempt || submitting) return;
    submittedRef.current = true;
    setSubmitting(true);
    setSubmissionError(null);

    try {
      await persistAnswerDraft(currentAttempt.id);
      const [, recordingSaved] = await Promise.all([
        submitAndGradeAttempt(currentAttempt.id, status),
        stopRecordingAndUpload(),
      ]);
      setSubmissionCompleted(true);

      if (!recordingSaved) {
        throw new Error(recording.recordingError ?? 'تعذّر رفع التسجيل. أعد المحاولة أو اختر عرض النتيجة بدونه.');
      }

      setShowSubmitConfirm(false);
      navigate(`/student/exam/${examId}/done`);
    } catch (err) {
      setSubmissionError(err instanceof Error ? err.message : 'تعذّر إكمال التسليم');
      setShowSubmitConfirm(true);
    } finally {
      setSubmitting(false);
    }
  }, [examId, recording.recordingError, stopRecordingAndUpload, submitting]);

  const handleTimeExpired = useCallback(async () => {
    if (submittedRef.current || !attemptRef.current) return;
    setShowSubmitConfirm(true);
    await finishSubmission('auto_submitted');
  }, [finishSubmission]);

  useEffect(() => {
    if (remainingSeconds === 0 && !alreadySubmitted && !loading) {
      handleTimeExpired();
    }
  }, [remainingSeconds, alreadySubmitted, loading, handleTimeExpired]);

  // Leaving the tab does not reset or prematurely submit the server-timed attempt.
  useEffect(() => {
    if (loading || alreadySubmitted || !attempt) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!submittedRef.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [loading, alreadySubmitted, attempt]);

  const handleSelectAnswer = async (questionId: string, answer: CorrectAnswer) => {
    const next = new Map(answersRef.current);
    next.set(questionId, answer);
    answersRef.current = next;
    setAnswers(next);

    if (!attempt) return;
    try {
      const draft = readAnswerDraft(attempt.id);
      draft[questionId] = answer;
      writeAnswerDraft(attempt.id, draft);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'تعذّر حفظ نسخة محلية من الإجابة', 'error');
    }

    setSaving(true);
    try {
      await saveAnswer(attempt.id, questionId, answer);
      const draft = readAnswerDraft(attempt.id);
      if (draft[questionId] === answer) delete draft[questionId];
      writeAnswerDraft(attempt.id, draft);
    } catch {
      showToast('تعذّر حفظ الإجابة على الخادم. ستتم إعادة المحاولة عند عودة الاتصال.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = () => {
    void finishSubmission(remainingSeconds === 0 ? 'auto_submitted' : 'submitted');
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  // Render states
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <Logo size="sm" />
        <p className="mt-8 text-sm text-gray-500">جاري تحميل الامتحان...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <header className="px-6 py-5 border-b border-gray-100 bg-white">
          <div className="max-w-4xl mx-auto"><Logo size="sm" /></div>
        </header>
        <main className="flex-1 flex items-center justify-center px-6 py-12">
          <div className="max-w-md text-center">
            <div className="inline-flex h-16 w-16 rounded-2xl bg-red-100 items-center justify-center text-red-600 mb-4">
              <AlertTriangle className="h-8 w-8" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">حدث خطأ</h1>
            <p className="text-sm text-gray-500 mb-6">{error}</p>
            <button onClick={() => navigate('/student')} className="btn-primary">
              العودة لمنطقة الطالب
            </button>
          </div>
        </main>
      </div>
    );
  }

  if (alreadySubmitted) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <header className="px-6 py-5 border-b border-gray-100 bg-white">
          <div className="max-w-4xl mx-auto"><Logo size="sm" /></div>
        </header>
        <main className="flex-1 flex items-center justify-center px-6 py-12">
          <div className="max-w-md text-center animate-scale-in">
            <div className="inline-flex h-16 w-16 rounded-2xl bg-green-100 items-center justify-center text-green-600 mb-4">
              <Check className="h-8 w-8" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">تم تسليم الامتحان</h1>
            <p className="text-sm text-gray-500 mb-6">لقد تم تسليم هذا الامتحان بالفعل.</p>
            <button onClick={() => navigate(`/student/exam/${examId}/done`)} className="btn-primary">
              عرض النتيجة
            </button>
          </div>
        </main>
      </div>
    );
  }

  if (!exam || !attempt || questions.length === 0) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <header className="px-6 py-5 border-b border-gray-100 bg-white">
          <div className="max-w-4xl mx-auto"><Logo size="sm" /></div>
        </header>
        <main className="flex-1 flex items-center justify-center px-6 py-12">
          <div className="max-w-md text-center">
            <div className="inline-flex h-16 w-16 rounded-2xl bg-gray-100 items-center justify-center text-gray-400 mb-4">
              <FileText className="h-8 w-8" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">لا توجد أسئلة</h1>
            <p className="text-sm text-gray-500 mb-6">هذا الامتحان لا يحتوي على أسئلة بعد.</p>
            <button onClick={() => navigate('/student')} className="btn-primary">
              العودة لمنطقة الطالب
            </button>
          </div>
        </main>
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];
  const selectedAnswer = answers.get(currentQuestion.id);
  const answeredCount = answers.size;
  const progress = ((currentIndex + 1) / questions.length) * 100;
  const isLastQuestion = currentIndex === questions.length - 1;
  const hasTimer = remainingSeconds !== null;
  const isLowTime = remainingSeconds !== null && remainingSeconds <= 300 && remainingSeconds > 0;
  const isCriticalTime = remainingSeconds !== null && remainingSeconds <= 60 && remainingSeconds > 0;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col" dir="rtl">
      {/* Header */}
      <header className="px-4 py-4 bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <Logo size="sm" />
            <div className="flex items-center gap-3">
              {/* Recording indicator */}
              {recording.isRecording && (
                <span
                  role="status"
                  aria-label="التسجيل جارٍ"
                  title="التسجيل جارٍ"
                  className="flex items-center gap-1.5 rounded-lg bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600"
                >
                  <Video className="h-3.5 w-3.5" />
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                </span>
              )}
              {recording.isUploading && (
                <span className="flex items-center gap-1.5 rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-600">
                  <Upload className="h-3.5 w-3.5" />
                  {recording.uploadStatus ?? 'جاري الرفع...'}
                </span>
              )}
              {/* Timer */}
              {hasTimer && (
                <div
                  className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-bold tabular-nums transition-all ${
                    isCriticalTime
                      ? 'bg-red-100 text-red-700 animate-pulse'
                      : isLowTime
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  <Clock className="h-4 w-4" />
                  <span>{formatTime(remainingSeconds ?? 0)}</span>
                </div>
              )}
              {saving && (
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                  جاري الحفظ
                </span>
              )}
              <span className="text-xs font-medium text-gray-500 hidden sm:inline">
                {answeredCount} / {questions.length} مجاب
              </span>
            </div>
          </div>
          {/* Progress bar */}
          <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full bg-blue-700 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </header>

      {/* Five-minute warning banner */}
      {showFiveMinWarning && remainingSeconds !== null && remainingSeconds > 0 && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 animate-slide-up">
          <div className="max-w-2xl mx-auto flex items-center gap-2.5">
            <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
            <p className="text-sm font-semibold text-amber-800">
              تنبيه: تبقى أقل من 5 دقائق على انتهاء الامتحان.
            </p>
          </div>
        </div>
      )}

      {recording.recordingError && (
        <div role="alert" className="border-b border-red-200 bg-red-50 px-4 py-3">
          <div className="mx-auto max-w-2xl flex items-center gap-2.5 text-sm font-medium text-red-800">
            <AlertTriangle className="h-5 w-5 flex-shrink-0" />
            <span>تعذّر حفظ التسجيل: {recording.recordingError}</span>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 px-4 py-6">
        <div className="max-w-2xl mx-auto">
          {/* Question number */}
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-bold text-gray-400">
              السؤال {currentIndex + 1} من {questions.length}
            </span>
            <span className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
              {currentQuestion.points} درجة
            </span>
          </div>

          {/* Question card */}
          <div className="card p-6 mb-6 animate-fade-in" key={currentQuestion.id}>
            <p className="text-lg font-bold text-gray-900 leading-relaxed mb-6">
              {currentQuestion.question_text}
            </p>

            {/* Choices */}
            <div className="space-y-3">
              {CHOICES.map((choice) => {
                const choiceText = currentQuestion[`choice_${choice.key.toLowerCase()}` as keyof StudentQuestion] as string;
                const isSelected = selectedAnswer === choice.key;

                return (
                  <button
                    key={choice.key}
                    onClick={() => handleSelectAnswer(currentQuestion.id, choice.key)}
                    className={`w-full flex items-center gap-4 rounded-xl border-2 px-4 py-4 text-right transition-all active:scale-[0.99] ${
                      isSelected
                        ? 'border-blue-700 bg-blue-50'
                        : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <span className={`flex-shrink-0 h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                      isSelected
                        ? 'bg-blue-700 text-white'
                        : 'bg-gray-100 text-gray-500'
                    }`}>
                      {isSelected ? <Check className="h-5 w-5" /> : choice.label}
                    </span>
                    <span className={`text-base ${isSelected ? 'font-semibold text-blue-900' : 'text-gray-700'}`}>
                      {choiceText}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={handlePrev}
              disabled={currentIndex === 0}
              className="inline-flex items-center gap-2 rounded-xl bg-white border border-gray-200 px-5 py-3 text-sm font-semibold text-gray-700 shadow-sm transition-all hover:bg-gray-50 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight className="h-4 w-4" />
              <span>السابق</span>
            </button>

            {isLastQuestion ? (
              <button
                onClick={() => setShowSubmitConfirm(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-green-700 active:scale-[0.98]"
              >
                <Flag className="h-4 w-4" />
                <span>إنهاء وتصحيح</span>
              </button>
            ) : (
              <button
                onClick={handleNext}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-800 active:scale-[0.98]"
              >
                <span>التالي</span>
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Question navigator */}
          <div className="mt-8">
            <p className="text-xs font-medium text-gray-400 mb-3 text-center">انتقل إلى سؤال</p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {questions.map((q, i) => {
                const isAnswered = answers.has(q.id);
                const isCurrent = i === currentIndex;
                return (
                  <button
                    key={q.id}
                    onClick={() => setCurrentIndex(i)}
                    className={`h-9 w-9 rounded-lg text-xs font-bold transition-all ${
                      isCurrent
                        ? 'bg-blue-700 text-white ring-2 ring-blue-200'
                        : isAnswered
                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </main>

      {/* Submit confirmation dialog */}
      {showSubmitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div
            className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm"
            onClick={() => !submitting && !submissionCompleted && setShowSubmitConfirm(false)}
          />
          <div className="relative w-full max-w-md card p-6 animate-scale-in">
            <div className="flex items-start gap-4 mb-5">
              <div className="h-12 w-12 rounded-xl bg-green-100 flex items-center justify-center text-green-600 flex-shrink-0">
                <Flag className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-1">إنهاء الامتحان</h3>
                <p className="text-sm text-gray-500 leading-relaxed">
                  هل أنت متأكد من إنهاء الامتحان؟ ستظهر النتيجة بعد حفظ الإجابات ورفع التسجيل.
                </p>
              </div>
            </div>

            <div className="rounded-xl bg-gray-50 px-4 py-3 mb-5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">الأسئلة المجاب عنها</span>
                <span className="font-bold text-gray-900">{answeredCount} من {questions.length}</span>
              </div>
              {answeredCount < questions.length && (
                <p className="text-xs text-amber-600 mt-2">
                  هناك {questions.length - answeredCount} أسئلة بدون إجابة
                </p>
              )}
            </div>

            {submitting && (
              <div role="status" className="mb-5 rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-800">
                {recording.isUploading
                  ? recording.uploadStatus ?? 'جاري رفع التسجيل، ستظهر النتيجة بعد اكتماله...'
                  : 'جاري حفظ الإجابات وتصحيحها...'}
              </div>
            )}

            {submissionError && (
              <div role="alert" className="mb-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                {submissionError}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  if (submissionCompleted) {
                    navigate(`/student/exam/${examId}/done`);
                  } else {
                    setShowSubmitConfirm(false);
                  }
                }}
                className="btn-secondary flex-1"
                disabled={submitting}
              >
                {submissionCompleted ? 'عرض النتيجة دون التسجيل' : 'متابعة الامتحان'}
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-green-600 hover:bg-green-700 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-all active:scale-[0.98] flex-1 disabled:opacity-50"
              >
                {submitting
                  ? recording.isUploading ? recording.uploadStatus ?? 'جاري رفع التسجيل...' : 'جاري الحفظ والتصحيح...'
                  : submissionCompleted ? 'إعادة محاولة رفع التسجيل' : 'إنهاء ورفع التسجيل'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
