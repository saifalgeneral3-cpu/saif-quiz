import { useEffect, useState } from 'react';
import { ArrowRight, User, Phone, FileText, Award, TrendingUp, Clock, Check, X, Video, Mic, AlertCircle, Loader2 } from 'lucide-react';
import { navigate } from '@/hooks/useRouter';
import { fetchAttemptDetail, type AttemptDetail } from '@/services/resultsService';
import { createSignedUrl } from '@/services/recordingService';
import type { CorrectAnswer } from '@/types';

interface AdminResultDetailPageProps {
  attemptId: string;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'submitted': return 'تم التسليم';
    case 'auto_submitted': return 'تسليم تلقائي';
    case 'graded': return 'تم التصحيح';
    default: return status;
  }
}

const CHOICE_LABELS: Record<CorrectAnswer, string> = { A: 'A', B: 'B', C: 'C', D: 'D' };

export function AdminResultDetailPage({ attemptId }: AdminResultDetailPageProps) {
  const [detail, setDetail] = useState<AttemptDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const d = await fetchAttemptDetail(attemptId);
        setDetail(d);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'حدث خطأ أثناء تحميل التفاصيل');
      } finally {
        setLoading(false);
      }
    })();
  }, [attemptId]);

  // Generate signed URLs for recordings
  useEffect(() => {
    if (!detail?.recordings || detail.recordings.length === 0) return;

    setMediaLoading(true);
    setMediaError(null);
    (async () => {
      try {
        const videoRec = detail.recordings.find((r) => r.type === 'camera' && r.video_path && r.status === 'uploaded');
        const audioRec = detail.recordings.find((r) => r.type === 'audio' && r.audio_path && r.status === 'uploaded');

        const [vUrl, aUrl] = await Promise.all([
          videoRec ? createSignedUrl(videoRec.video_path!) : Promise.resolve(null),
          audioRec ? createSignedUrl(audioRec.audio_path!) : Promise.resolve(null),
        ]);

        setVideoUrl(vUrl);
        setAudioUrl(aUrl);
      } catch (err) {
        setMediaError(err instanceof Error ? err.message : 'تعذّر إنشاء رابط آمن للتسجيل');
      } finally {
        setMediaLoading(false);
      }
    })();
  }, [detail?.recordings]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-gray-300" />
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="card p-12 text-center animate-scale-in">
        <div className="inline-flex h-16 w-16 rounded-2xl bg-red-100 items-center justify-center text-red-600 mb-4">
          <AlertCircle className="h-8 w-8" />
        </div>
        <h2 className="text-lg font-bold text-gray-900 mb-2">تعذّر تحميل النتيجة</h2>
        <p className="text-sm text-gray-500 mb-6">{error ?? 'حدث خطأ غير متوقع'}</p>
        <button onClick={() => navigate('/admin/results')} className="btn-primary">
          العودة للنتائج
        </button>
      </div>
    );
  }

  const { attempt, student, exam, questions, answers, recordings } = detail;
  const percentage = attempt.score !== null && attempt.max_score !== null && attempt.max_score > 0
    ? Math.round((attempt.score / attempt.max_score) * 100)
    : null;

  const answerMap = new Map(answers.map((a) => [a.question_id, a]));

  const videoRec = recordings.find((r) => r.type === 'camera');
  const audioRec = recordings.find((r) => r.type === 'audio');

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Back button */}
      <button
        onClick={() => navigate('/admin/results')}
        className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
      >
        <ArrowRight className="h-4 w-4" />
        العودة للنتائج
      </button>

      {/* Student & attempt info */}
      <div className="card p-6">
        <div className="grid md:grid-cols-2 gap-6">
          {/* Student info */}
          <div>
            <h3 className="text-sm font-semibold text-gray-400 mb-3">معلومات الطالب</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-blue-50 flex items-center justify-center text-blue-700">
                  <User className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs text-gray-400">الاسم</p>
                  <p className="text-sm font-semibold text-gray-900">{student?.full_name ?? '—'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600">
                  <Phone className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs text-gray-400">الهاتف</p>
                  <p className="text-sm font-semibold text-gray-900" dir="ltr">{student?.phone ?? '—'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600">
                  <FileText className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs text-gray-400">الامتحان</p>
                  <p className="text-sm font-semibold text-gray-900">{exam?.title ?? '—'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Score info */}
          <div>
            <h3 className="text-sm font-semibold text-gray-400 mb-3">النتيجة</h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl bg-gray-50 p-4 text-center">
                <Award className="h-5 w-5 text-gray-400 mx-auto mb-1.5" />
                <p className="text-xl font-bold text-gray-900">{attempt.score ?? '—'}</p>
                <p className="text-xs text-gray-500">الدرجة</p>
              </div>
              <div className="rounded-xl bg-gray-50 p-4 text-center">
                <Award className="h-5 w-5 text-gray-400 mx-auto mb-1.5" />
                <p className="text-xl font-bold text-gray-900">{attempt.max_score ?? '—'}</p>
                <p className="text-xs text-gray-500">العظمى</p>
              </div>
              <div className="rounded-xl bg-gray-50 p-4 text-center">
                <TrendingUp className="h-5 w-5 text-gray-400 mx-auto mb-1.5" />
                <p className={`text-xl font-bold ${percentage !== null ? (percentage >= 50 ? 'text-green-600' : 'text-red-600') : 'text-gray-900'}`}>
                  {percentage !== null ? `${percentage}%` : '—'}
                </p>
                <p className="text-xs text-gray-500">النسبة</p>
              </div>
            </div>
          </div>
        </div>

        {/* Timing & status */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-6 pt-6 border-t border-gray-100">
          <div>
            <p className="text-xs text-gray-400 mb-1">وقت البدء</p>
            <p className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-gray-400" />
              {formatDateTime(attempt.started_at)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">وقت التسليم</p>
            <p className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-gray-400" />
              {formatDateTime(attempt.submitted_at)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">الحالة</p>
            <span className="inline-block rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">
              {getStatusLabel(attempt.status)}
            </span>
          </div>
        </div>
      </div>

      {/* Questions review */}
      <div className="card p-6">
        <h3 className="font-bold text-gray-900 mb-4">مراجعة الإجابات</h3>
        <div className="space-y-3">
          {questions.map((q, i) => {
            const ans = answerMap.get(q.id);
            const isCorrect = ans?.is_correct === true;
            const hasAnswer = ans?.selected_answer !== null && ans?.selected_answer !== undefined;
            const earnedPoints = isCorrect ? q.points : 0;

            return (
              <div
                key={q.id}
                className={`rounded-xl border p-4 ${isCorrect ? 'border-green-200 bg-green-50/30' : hasAnswer ? 'border-red-200 bg-red-50/30' : 'border-gray-200 bg-gray-50/30'}`}
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex items-start gap-3">
                    <span className={`flex-shrink-0 h-7 w-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                      isCorrect ? 'bg-green-600 text-white' : hasAnswer ? 'bg-red-500 text-white' : 'bg-gray-300 text-gray-600'
                    }`}>
                      {isCorrect ? <Check className="h-4 w-4" /> : hasAnswer ? <X className="h-4 w-4" /> : i + 1}
                    </span>
                    <p className="text-sm font-semibold text-gray-900 leading-relaxed">
                      {i + 1}. {q.question_text}
                    </p>
                  </div>
                  <span className="flex-shrink-0 text-xs font-semibold text-gray-500 rounded-lg bg-white px-2 py-1">
                    {earnedPoints} / {q.points} درجة
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div className="rounded-lg bg-white px-3 py-2">
                    <p className="text-xs text-gray-400 mb-1">إجابة الطالب</p>
                    <p className="text-sm font-medium text-gray-900">
                      {hasAnswer ? (
                        `${CHOICE_LABELS[ans!.selected_answer!]} — ${q[`choice_${ans!.selected_answer!.toLowerCase()}` as keyof typeof q] as string}`
                      ) : (
                        <span className="text-gray-400">لم يجب</span>
                      )}
                    </p>
                  </div>
                  <div className="rounded-lg bg-white px-3 py-2">
                    <p className="text-xs text-gray-400 mb-1">الإجابة الصحيحة</p>
                    <p className="text-sm font-medium text-green-700">
                      {CHOICE_LABELS[q.correct_answer]} — {q[`choice_${q.correct_answer.toLowerCase()}` as keyof typeof q] as string}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}

          {questions.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">لا توجد أسئلة لهذا الامتحان</p>
          )}
        </div>
      </div>

      {/* Recordings */}
      <div className="card p-6">
        <h3 className="font-bold text-gray-900 mb-4">التسجيلات</h3>

        {mediaError && (
          <div role="alert" className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            {mediaError}
          </div>
        )}

        {mediaLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-gray-300" />
          </div>
        )}

        {!mediaLoading && recordings.length === 0 && (
          <div className="text-center py-8">
            <div className="inline-flex h-12 w-12 rounded-xl bg-gray-100 items-center justify-center text-gray-400 mb-3">
              <Video className="h-6 w-6" />
            </div>
            <p className="text-sm text-gray-400">لا توجد تسجيلات لهذا الامتحان</p>
          </div>
        )}

        {!mediaLoading && recordings.length > 0 && (
          <div className="grid md:grid-cols-2 gap-4">
            {/* Video player */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Video className="h-4 w-4 text-gray-400" />
                <span className="text-sm font-medium text-gray-700">فيديو الكاميرا</span>
                {videoRec && (
                  <span className={`text-xs font-semibold rounded px-1.5 py-0.5 ${
                    videoRec.status === 'uploaded' ? 'bg-green-100 text-green-700' :
                    videoRec.status === 'failed' ? 'bg-red-100 text-red-700' :
                    'bg-amber-100 text-amber-700'
                  }`}>
                    {videoRec.status === 'uploaded' ? 'متاح' : videoRec.status === 'failed' ? 'فشل' : 'قيد الرفع'}
                  </span>
                )}
              </div>
              {videoUrl ? (
                <video
                  src={videoUrl}
                  controls
                  className="w-full rounded-xl bg-gray-900"
                  style={{ maxHeight: 240 }}
                />
              ) : (
                <div className="rounded-xl bg-gray-100 p-8 text-center">
                  <Video className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-xs text-gray-400">
                    {videoRec?.status === 'failed' ? 'فشل رفع التسجيل' : 'لا يوجد تسجيل فيديو متاح'}
                  </p>
                </div>
              )}
            </div>

            {/* Audio player */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Mic className="h-4 w-4 text-gray-400" />
                <span className="text-sm font-medium text-gray-700">الصوت</span>
                {audioRec && (
                  <span className={`text-xs font-semibold rounded px-1.5 py-0.5 ${
                    audioRec.status === 'uploaded' ? 'bg-green-100 text-green-700' :
                    audioRec.status === 'failed' ? 'bg-red-100 text-red-700' :
                    'bg-amber-100 text-amber-700'
                  }`}>
                    {audioRec.status === 'uploaded' ? 'متاح' : audioRec.status === 'failed' ? 'فشل' : 'قيد الرفع'}
                  </span>
                )}
              </div>
              {audioUrl ? (
                <audio src={audioUrl} controls className="w-full rounded-xl" />
              ) : (
                <div className="rounded-xl bg-gray-100 p-8 text-center">
                  <Mic className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-xs text-gray-400">
                    {audioRec?.status === 'failed' ? 'فشل رفع التسجيل' : 'لا يوجد تسجيل صوتي متاح'}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
