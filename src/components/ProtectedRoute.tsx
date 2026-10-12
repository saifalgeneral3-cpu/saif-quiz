import { type ReactNode, useEffect, useState } from 'react';
import { FullPageLoader } from '@/components/Loader';
import { useAuth } from '@/hooks/useAuth';
import { navigate } from '@/hooks/useRouter';

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedAdminRoute({ children }: ProtectedRouteProps) {
  const { admin, loading } = useAuth();
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    if (!loading && !admin) {
      setRedirecting(true);
      navigate('/admin/login');
    }
  }, [admin, loading]);

  if (loading || redirecting) {
    return <FullPageLoader message="جاري التحقق من الصلاحيات..." />;
  }

  if (!admin) {
    return <FullPageLoader message="جاري إعادة التوجيه..." />;
  }

  return <>{children}</>;
}
