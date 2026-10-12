import { useAuth } from '@/hooks/useAuth';
import { useHashRoute } from '@/hooks/useRouter';
import { FullPageLoader } from '@/components/Loader';
import { ProtectedAdminRoute } from '@/components/ProtectedRoute';
import { LandingPage } from '@/pages/LandingPage';
import { AdminLoginPage } from '@/pages/AdminLoginPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { StudentEntryPage } from '@/pages/StudentEntryPage';
import { StudentAreaPage } from '@/pages/StudentAreaPage';
import { ExamInstructionsPage } from '@/pages/ExamInstructionsPage';
import { ExamRunnerPage } from '@/pages/ExamRunnerPage';
import { ExamSubmittedPage } from '@/pages/ExamSubmittedPage';

function App() {
  const { route } = useHashRoute();
  const { admin, loading } = useAuth();

  const isAdminRoute = route.startsWith('/admin');

  if (isAdminRoute && loading) {
    return <FullPageLoader message="جاري التحميل..." />;
  }

  // Landing / student entry
  if (route === '/' || route === '') {
    return <LandingPage />;
  }

  // Student entry (name + phone registration)
  if (route === '/enter') {
    return <StudentEntryPage />;
  }

  // Student area (list of available exams)
  if (route === '/student') {
    return <StudentAreaPage />;
  }

  // Student exam sub-routes: /student/exam/:examId/:action
  const studentExamMatch = route.match(/^\/student\/exam\/([a-f0-9-]+)\/(.+)$/);
  if (studentExamMatch) {
    const examId = studentExamMatch[1];
    const action = studentExamMatch[2];

    if (action === 'instructions') {
      return <ExamInstructionsPage examId={examId} />;
    }
    if (action === 'run') {
      return <ExamRunnerPage examId={examId} />;
    }
    if (action === 'done') {
      return <ExamSubmittedPage examId={examId} />;
    }
  }

  // Admin routes
  if (route === '/admin/login') {
    if (admin) {
      window.location.hash = '/admin';
      return <FullPageLoader message="جاري التوجيه..." />;
    }
    return <AdminLoginPage />;
  }

  if (route === '/admin' || route.startsWith('/admin/')) {
    const subRoute = route === '/admin' ? '' : route.replace(/^\/admin\/?/, '');
    return (
      <ProtectedAdminRoute>
        <DashboardPage admin={admin!} subRoute={subRoute} />
      </ProtectedAdminRoute>
    );
  }

  return <LandingPage />;
}

export default App;
