import { useEffect, useState, useCallback } from 'react';
import { BarChart3, Filter, Search, ChevronLeft, Users, CheckCircle2, Clock, AlertCircle, TrendingUp, Award, ArrowRight } from 'lucide-react';
import { navigate } from '@/hooks/useRouter';
import { fetchAllResults, fetchAllExams, fetchExamStatistics, type ResultRow, type ResultFilters, type ExamStatistics } from '@/services/resultsService';
import type { Exam, AttemptStatus } from '@/types';

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
}

function getStatusLabel(status: AttemptStatus): string {
  switch (status) {
    case 'submitted': return 'تم التسليم';
    case 'auto_submitted': return 'تسليم تلقائي';
    case 'graded': return 'تم التصحيح';
    case 'in_progress': return 'قيد التقدم';
    case 'not_started': return 'لم يبدأ';
    default: return status;
  }
}

function getStatusStyle(status: AttemptStatus): string {
  switch (status) {
    case 'submitted': return 'bg-green-100 text-green-700';
    case 'auto_submitted': return 'bg-amber-100 text-amber-700';
    case 'graded': return 'bg-blue-100 text-blue-700';
    default: return 'bg-gray-100 text-gray-600';
  }
}

function getPercentage(score: number | null, maxScore: number | null): number | null {
  if (score === null || maxScore === null || maxScore === 0) return null;
  return Math.round((score / maxScore) * 100);
}

export function AdminResultsPage() {
  const [results, setResults] = useState<ResultRow[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [examLoadError, setExamLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [examFilter, setExamFilter] = useState<string>('');
  const [studentFilter, setStudentFilter] = useState<string>('');
  const [phoneFilter, setPhoneFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [minScoreFilter, setMinScoreFilter] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);

  // Exam statistics
  const [selectedExamForStats, setSelectedExamForStats] = useState<string>('');
  const [examStats, setExamStats] = useState<ExamStatistics | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);

  const loadResults = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filters: ResultFilters = {
        examId: examFilter || null,
        studentName: studentFilter || null,
        phone: phoneFilter || null,
        status: (statusFilter || null) as AttemptStatus | null,
        minScore: minScoreFilter ? Number(minScoreFilter) : null,
      };
      const data = await fetchAllResults(filters);
      setResults(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ أثناء تحميل النتائج');
    } finally {
      setLoading(false);
    }
  }, [examFilter, studentFilter, phoneFilter, statusFilter, minScoreFilter]);

  useEffect(() => {
    (async () => {
      try {
        const allExams = await fetchAllExams();
        setExams(allExams);
      } catch (err) {
        setExamLoadError(err instanceof Error ? err.message : 'تعذّر تحميل قائمة الامتحانات');
      }
    })();
  }, []);

  useEffect(() => {
    loadResults();
  }, [loadResults]);

  // Load exam statistics when an exam is selected
  useEffect(() => {
    if (!selectedExamForStats) {
      setExamStats(null);
      setStatsError(null);
      return;
    }
    setStatsLoading(true);
    setStatsError(null);
    (async () => {
      try {
        const stats = await fetchExamStatistics(selectedExamForStats);
        setExamStats(stats);
      } catch (err) {
        setExamStats(null);
        setStatsError(err instanceof Error ? err.message : 'تعذّر تحميل إحصائيات الامتحان');
      } finally {
        setStatsLoading(false);
      }
    })();
  }, [selectedExamForStats]);

  const handleResetFilters = () => {
    setExamFilter('');
    setStudentFilter('');
    setPhoneFilter('');
    setStatusFilter('');
    setMinScoreFilter('');
  };

  const hasActiveFilters = examFilter || studentFilter || phoneFilter || statusFilter || minScoreFilter;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Exam Statistics Section */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-700">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-bold text-gray-900">إحصائيات الامتحان</h2>
            <p className="text-xs text-gray-500">اختر امتحاناً لعرض إحصائياته</p>
          </div>
        </div>

        <select
          value={selectedExamForStats}
          onChange={(e) => setSelectedExamForStats(e.target.value)}
          className="input-field mb-4"
        >
          <option value="">— اختر امتحان —</option>
          {exams.map((exam) => (
            <option key={exam.id} value={exam.id}>{exam.title}</option>
          ))}
        </select>

        {examLoadError && (
          <p role="alert" className="mb-3 text-sm text-red-700">{examLoadError}</p>
        )}
        {statsError && (
          <p role="alert" className="mb-3 text-sm text-red-700">{statsError}</p>
        )}

        {statsLoading && (
          <p className="text-sm text-gray-400 text-center py-4">جاري تحميل الإحصائيات...</p>
        )}

        {!statsLoading && examStats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 animate-fade-in">
            <StatBox icon={Users} label="إجمالي الطلاب" value={examStats.totalStudents.toString()} color="bg-gray-100 text-gray-700" />
            <StatBox icon={Clock} label="بدأ" value={examStats.started.toString()} color="bg-blue-50 text-blue-700" />
            <StatBox icon={CheckCircle2} label="تم التسليم" value={examStats.submitted.toString()} color="bg-green-50 text-green-700" />
            <StatBox icon={AlertCircle} label="تسليم تلقائي" value={examStats.autoSubmitted.toString()} color="bg-amber-50 text-amber-700" />
            <StatBox icon={TrendingUp} label="متوسط الدرجات" value={examStats.averageScore !== null ? `${examStats.averageScore}%` : '—'} color="bg-blue-50 text-blue-700" />
            <StatBox icon={Award} label="أعلى درجة" value={examStats.highestScore !== null ? `${Math.round(examStats.highestScore)}%` : '—'} color="bg-green-50 text-green-700" />
            <StatBox icon={Award} label="أقل درجة" value={examStats.lowestScore !== null ? `${Math.round(examStats.lowestScore)}%` : '—'} color="bg-red-50 text-red-700" />
            <StatBox icon={CheckCircle2} label="نسبة النجاح" value={examStats.passRate !== null ? `${examStats.passRate}%` : '—'} color="bg-green-50 text-green-700" />
          </div>
        )}

        {!statsLoading && selectedExamForStats && !examStats && !statsError && (
          <p className="text-sm text-gray-400 text-center py-4">لا توجد بيانات متاحة</p>
        )}
      </div>

      {/* Filters */}
      <div className="card p-6">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center justify-between w-full mb-2"
        >
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-gray-400" />
            <span className="font-semibold text-gray-900">تصفية النتائج</span>
            {hasActiveFilters && (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-700">
                نشط
              </span>
            )}
          </div>
          <ChevronLeft className={`h-5 w-5 text-gray-400 transition-transform ${showFilters ? '-rotate-90' : ''}`} />
        </button>

        {showFilters && (
          <div className="grid md:grid-cols-3 gap-3 mt-4 animate-fade-in">
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1.5 block">الامتحان</label>
              <select
                value={examFilter}
                onChange={(e) => setExamFilter(e.target.value)}
                className="input-field"
              >
                <option value="">الكل</option>
                {exams.map((exam) => (
                  <option key={exam.id} value={exam.id}>{exam.title}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1.5 block">اسم الطالب</label>
              <input
                type="text"
                value={studentFilter}
                onChange={(e) => setStudentFilter(e.target.value)}
                placeholder="بحث بالاسم..."
                className="input-field"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1.5 block">الهاتف</label>
              <input
                type="text"
                value={phoneFilter}
                onChange={(e) => setPhoneFilter(e.target.value)}
                placeholder="بحث بالهاتف..."
                className="input-field"
                dir="ltr"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1.5 block">الحالة</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="input-field"
              >
                <option value="">الكل</option>
                <option value="submitted">تم التسليم</option>
                <option value="auto_submitted">تسليم تلقائي</option>
                <option value="graded">تم التصحيح</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1.5 block">أقل درجة</label>
              <input
                type="number"
                value={minScoreFilter}
                onChange={(e) => setMinScoreFilter(e.target.value)}
                placeholder="0"
                min="0"
                className="input-field"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={handleResetFilters}
                className="btn-secondary w-full"
              >
                إعادة تعيين
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Results table */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-bold text-gray-900">النتائج</h2>
          <span className="text-sm text-gray-400">{results.length} نتيجة</span>
        </div>

        {loading && (
          <div className="p-12 text-center">
            <p className="text-sm text-gray-400">جاري تحميل النتائج...</p>
          </div>
        )}

        {error && (
          <div className="p-12 text-center">
            <p className="text-sm text-red-500">{error}</p>
          </div>
        )}

        {!loading && !error && results.length === 0 && (
          <div className="p-12 text-center">
            <div className="inline-flex h-16 w-16 rounded-2xl bg-gray-100 items-center justify-center text-gray-400 mb-4">
              <Search className="h-8 w-8" />
            </div>
            <p className="text-sm text-gray-500">لا توجد نتائج مطابقة</p>
          </div>
        )}

        {!loading && !error && results.length > 0 && (
          <>
            {/* Desktop table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-gray-400 text-xs">
                    <th className="px-6 py-3 text-right font-medium">الطالب</th>
                    <th className="px-6 py-3 text-right font-medium">الهاتف</th>
                    <th className="px-6 py-3 text-right font-medium">الامتحان</th>
                    <th className="px-6 py-3 text-center font-medium">الدرجة</th>
                    <th className="px-6 py-3 text-center font-medium">النسبة</th>
                    <th className="px-6 py-3 text-right font-medium">البداية</th>
                    <th className="px-6 py-3 text-right font-medium">التسليم</th>
                    <th className="px-6 py-3 text-center font-medium">الحالة</th>
                    <th className="px-6 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((row) => {
                    const pct = getPercentage(row.attempt.score, row.attempt.max_score);
                    return (
                      <tr
                        key={row.attempt.id}
                        className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors cursor-pointer"
                        onClick={() => navigate(`/admin/results/${row.attempt.id}`)}
                      >
                        <td className="px-6 py-3 font-medium text-gray-900">{row.student?.full_name ?? '—'}</td>
                        <td className="px-6 py-3 text-gray-500" dir="ltr">{row.student?.phone ?? '—'}</td>
                        <td className="px-6 py-3 text-gray-700">{row.exam?.title ?? '—'}</td>
                        <td className="px-6 py-3 text-center font-semibold text-gray-900">
                          {row.attempt.score !== null ? `${row.attempt.score} / ${row.attempt.max_score ?? '—'}` : '—'}
                        </td>
                        <td className="px-6 py-3 text-center">
                          {pct !== null ? (
                            <span className={`font-bold ${pct >= 50 ? 'text-green-600' : 'text-red-600'}`}>{pct}%</span>
                          ) : '—'}
                        </td>
                        <td className="px-6 py-3 text-gray-500 text-xs">{formatDateTime(row.attempt.started_at)}</td>
                        <td className="px-6 py-3 text-gray-500 text-xs">{formatDateTime(row.attempt.submitted_at)}</td>
                        <td className="px-6 py-3 text-center">
                          <span className={`inline-block rounded-lg px-2.5 py-1 text-xs font-semibold ${getStatusStyle(row.attempt.status)}`}>
                            {getStatusLabel(row.attempt.status)}
                          </span>
                        </td>
                        <td className="px-6 py-3">
                          <ArrowRight className="h-4 w-4 text-gray-300" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="lg:hidden divide-y divide-gray-50">
              {results.map((row) => {
                const pct = getPercentage(row.attempt.score, row.attempt.max_score);
                return (
                  <div
                    key={row.attempt.id}
                    className="p-4 cursor-pointer hover:bg-gray-50/50 transition-colors"
                    onClick={() => navigate(`/admin/results/${row.attempt.id}`)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-gray-900">{row.student?.full_name ?? '—'}</span>
                      <span className={`inline-block rounded-lg px-2 py-0.5 text-xs font-semibold ${getStatusStyle(row.attempt.status)}`}>
                        {getStatusLabel(row.attempt.status)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mb-2">{row.exam?.title ?? '—'}</p>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-400" dir="ltr">{row.student?.phone ?? '—'}</span>
                      {pct !== null && (
                        <span className={`font-bold ${pct >= 50 ? 'text-green-600' : 'text-red-600'}`}>
                          {row.attempt.score} / {row.attempt.max_score} ({pct}%)
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-400 mt-2">
                      <span>التسليم: {formatDateTime(row.attempt.submitted_at)}</span>
                      <ArrowRight className="h-4 w-4 text-gray-300" />
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StatBox({ icon: Icon, label, value, color }: { icon: typeof Users; label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl border border-gray-100 p-4 text-center">
      <div className={`inline-flex h-10 w-10 rounded-lg items-center justify-center mb-2 ${color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-lg font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}
