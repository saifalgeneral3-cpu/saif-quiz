import { supabase } from '@/lib/supabase';
import type { Admin } from '@/types';

export async function signInAdmin(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { data: null, error };
  }

  if (data.user) {
    const { data: admin, error: adminError } = await supabase
      .from('admins')
      .select('*')
      .eq('id', data.user.id)
      .maybeSingle();

    if (adminError || !admin) {
      await supabase.auth.signOut();
      return {
        data: null,
        error: { message: 'هذا الحساب ليس حساب أدمن مصرّح له' } as Error,
      };
    }

    if (!admin.is_active) {
      await supabase.auth.signOut();
      return {
        data: null,
        error: { message: 'تم تعطيل هذا الحساب. يرجى التواصل مع الإدارة' } as Error,
      };
    }

    return { data: { user: data.user, admin: admin as Admin }, error: null };
  }

  return { data: null, error: { message: 'حدث خطأ غير متوقع' } as Error };
}

export async function signOutAdmin() {
  await supabase.auth.signOut();
}

export async function getCurrentAdmin(): Promise<Admin | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: admin, error } = await supabase
    .from('admins')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return admin?.is_active ? admin as Admin : null;
}

export async function isAdminAuthenticated(): Promise<boolean> {
  const admin = await getCurrentAdmin();
  return admin !== null && admin.is_active;
}
