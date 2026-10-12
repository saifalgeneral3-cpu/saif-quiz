import { useState, useEffect, type ElementType } from 'react';
import { FileText, Users, TrendingUp, Calendar, Clock } from 'lucide-react';
import { DashboardShell } from '@/components/DashboardShell';
import { ExamListPage } from '@/pages/ExamListPage';
import { ExamFormPage } from '@/pages/ExamFormPage';
import { QuestionBuilderPage } from '@/pages/QuestionBuilderPage';
import { ExamPreviewPage } from '@/pages/ExamPreviewPage';
import { AdminResultsPage } from '@/pages/AdminResultsPage';
import { AdminResultDetailPage } from '@/pages/AdminResultDetailPage';
import { AdminStudentsPage } from '@/pages/AdminStudentsPage';
import { countExamsByStatus } from '@/services/examService';
import { countAllQuestions } from '@/services/questionService';
import { countStudents } from '@/services/studentService';
import { fetchRecentActivity, type RecentActivity } from '@/services/resultsService';
import type { Admin, ExamStatus } from '@/types';
import { navigate } from '@/hooks/useRouter';
import { AlertCircle, Loader2 } from 'lucide-react';

interface DashboardPageProps {
  admin: Admin;
  subRoute: string;
}

function StatCard({ icon, label, value, color }: { icon: ElementType; label: string; value: string; color: string }) {
  const Icon = icon;
  return (
    <div className="card p-6 hover:shadow-card-hover transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500 mt-1">{label}</p>
    </div>
  );
}

function HomeSection({ admin }: { admin: Admin }) {
  const [examCounts, setExamCounts] = useState<Record<ExamStatus, number> | null>(null);
  const [totalQuestions, setTotalQuestions] = useState<number | null>(null);
  const [totalStudents, setTotalStudents] = useState<number | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [counts, questionCount, studentCount, activity] = await Promise.all([
          countExamsByStatus(),
          countAllQuestions(),
          countStudents(),
          fetchRecentActivity(),
        ]);
        setExamCounts(counts);
        setTotalQuestions(questionCount);
        setTotalStudents(studentCount);
        setRecentActivity(activity);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'تعذّر تحميل إحصائيات لوحة التحكم');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const totalExams = examCounts ? Object.values(examCounts).reduce((a, b) => a + b, 0) : null;
  const formatActivityTime = (submittedAt: string) =>
    new Date(submittedAt).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Welcome */}
      <div className="card p-8 bg-gradient-to-l from-blue-700 to-blue-800 border-0 text-white">
        <h2 className="text-2xl font-bold mb-2">مرحباً بك، {admin.full_name || admin.email}</h2>
        <p className="text-blue-100 text-sm leading-relaxed">
          من هنا يمكنك إدارة الامتحانات ومتابعة الطلاب وعرض النتائج والتسجيلات.
        </p>
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={FileText} label="إجمالي الامتحانات" value={loading ? '…' : totalExams?.toString() ?? '—'} color="bg-blue-50 text-blue-700" />
        <StatCard icon={FileText} label="امتحانات مفعّلة" value={loading ? '…' : examCounts?.active?.toString() ?? '—'} color="bg-green-50 text-green-700" />
        <StatCard icon={FileText} label="أسئلة" value={loading ? '…' : totalQuestions?.toString() ?? '—'} color="bg-gray-100 text-gray-700" />
        <StatCard icon={Users} label="الطلاب" value={loading ? '…' : totalStudents?.toString() ?? '—'} color="bg-amber-50 text-amber-700" />
      </div>

      {/* Quick actions */}
      <div className="grid md:grid-cols-2 gap-4">
        <button
          onClick={() => navigate('/admin/exams')}
          className="card p-6 text-right hover:shadow-card-hover transition-shadow"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-700">
              <Calendar className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-gray-900">إدارة الامتحانات</h3>
          </div>
          <p className="text-sm text-gray-500">إنشاء وتعديل وتفعيل الامتحانات وإضافة الأسئلة</p>
        </button>

        <div className="card p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-xl bg-green-50 flex items-center justify-center text-green-700">
              <TrendingUp className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-gray-900">آخر النشاطات</h3>
          </div>
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          ) : recentActivity.length === 0 ? (
            <p className="text-sm text-gray-400">لا توجد نتائج مسلّمة بعد</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {recentActivity.map((activity) => (
                <li key={activity.attemptId}>
                  <button
                    onClick={() => navigate(`/admin/results/${activity.attemptId}`)}
                    className="flex w-full items-center justify-between gap-3 py-3 text-right hover:bg-gray-50"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-gray-800">{activity.studentName}</span>
                      <span className="block truncate text-xs text-gray-500">{activity.examTitle}</span>
                    </span>
                    <span className="flex flex-shrink-0 items-center gap-1 text-xs text-gray-400">
                      <Clock className="h-3.5 w-3.5" />
                      {formatActivityTime(activity.submittedAt)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export function DashboardPage({ admin, subRoute }: DashboardPageProps) {
  const [section, setSection] = useState('home');

  // Parse sub-route to determine active section and content
  useEffect(() => {
    if (subRoute === '' || subRoute === '/') {
      setSection('home');
    } else if (subRoute.startsWith('exams')) {
      setSection('exams');
    } else if (subRoute.startsWith('results')) {
      setSection('results');
    } else if (subRoute.startsWith('students')) {
      setSection('students');
    } else if (subRoute.startsWith('recordings')) {
      setSection('recordings');
    } else if (subRoute.startsWith('settings')) {
      setSection('settings');
    } else {
      setSection('home');
    }
  }, [subRoute]);

  const handleNavigate = (s: string) => {
    if (s === 'home') {
      navigate('/admin');
    } else {
      navigate(`/admin/${s}`);
    }
  };

  const renderContent = () => {
    // Home
    if (section === 'home') {
      return <HomeSection admin={admin} />;
    }

    // Exams section with sub-routes
    if (section === 'exams') {
      if (subRoute === 'exams' || subRoute === 'exams/') {
        return <ExamListPage />;
      }
      if (subRoute === 'exams/new') {
        return <ExamFormPage adminId={admin.id} />;
      }
      // exams/:id/edit
      const editMatch = subRoute.match(/^exams\/([a-f0-9-]+)\/edit$/);
      if (editMatch) {
        return <ExamFormPage adminId={admin.id} examId={editMatch[1]} />;
      }
      // exams/:id/questions
      const questionsMatch = subRoute.match(/^exams\/([a-f0-9-]+)\/questions$/);
      if (questionsMatch) {
        return <QuestionBuilderPage examId={questionsMatch[1]} />;
      }
      // exams/:id/preview
      const previewMatch = subRoute.match(/^exams\/([a-f0-9-]+)\/preview$/);
      if (previewMatch) {
        return <ExamPreviewPage examId={previewMatch[1]} />;
      }
      // Default to list
      return <ExamListPage />;
    }

    // Results section with sub-routes
    if (section === 'results') {
      if (subRoute === 'results' || subRoute === 'results/') {
        return <AdminResultsPage />;
      }
      // results/:attemptId
      const resultDetailMatch = subRoute.match(/^results\/([a-f0-9-]+)$/);
      if (resultDetailMatch) {
        return <AdminResultDetailPage attemptId={resultDetailMatch[1]} />;
      }
      return <AdminResultsPage />;
    }

    // Students section
    if (section === 'students') {
      return <AdminStudentsPage />;
    }

    if (section === 'recordings') {
      return <AdminResultsPage />;
    }

    return <HomeSection admin={admin} />;
  };

  // Determine custom title for sub-pages
  const getCustomTitle = (): string | undefined => {
    if (section === 'exams') {
      if (subRoute === 'exams/new') return 'امتحان جديد';
      if (subRoute.match(/^exams\/[a-f0-9-]+\/edit$/)) return 'تعديل الامتحان';
      if (subRoute.match(/^exams\/[a-f0-9-]+\/questions$/)) return 'إدارة الأسئلة';
      if (subRoute.match(/^exams\/[a-f0-9-]+\/preview$/)) return 'معاينة الامتحان';
      return 'الامتحانات';
    }
    if (section === 'results') {
      if (subRoute.match(/^results\/[a-f0-9-]+$/)) return 'تفاصيل النتيجة';
      return 'النتائج';
    }
    return undefined;
  };

  return (
    <DashboardShell
      admin={admin}
      activeSection={section}
      onNavigate={handleNavigate}
      title={getCustomTitle()}
    >
      {renderContent()}
    </DashboardShell>
  );
}
