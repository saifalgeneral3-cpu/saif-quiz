import { supabase } from '@/lib/supabase';
import type { Student } from '@/types';

export function normalizeStudentPhone(phone: string): string {
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, '');

  if (trimmed.startsWith('+') || digits.startsWith('964')) {
    return `+${digits}`;
  }

  if (digits.startsWith('0')) {
    return `+964${digits.slice(1)}`;
  }

  return `+964${digits}`;
}

async function ensureStudentSession(): Promise<void> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(error.message);

  if (!data.session) {
    const { error: signInError } = await supabase.auth.signInAnonymously();
    if (signInError) throw new Error(signInError.message);
  }
}

export async function findOrCreateStudent(fullName: string, phone: string): Promise<Student> {
  await ensureStudentSession();
  const { data, error } = await supabase.rpc('register_student', {
    p_full_name: fullName,
    p_phone: normalizeStudentPhone(phone),
  });

  if (error) throw new Error(error.message);
  const student = Array.isArray(data) ? data[0] : data;
  if (!student) throw new Error('تعذّر إنشاء ملف الطالب');
  return student as Student;
}

export async function signOutStudent(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(error.message);
}

export async function countStudents(): Promise<number> {
  const { count, error } = await supabase
    .from('students')
    .select('id', { count: 'exact', head: true });

  if (error) throw new Error(error.message);
  return count ?? 0;
}

export interface StudentWithStats {
  student: Student;
  attemptCount: number;
  latestScore: number | null;
  latestMaxScore: number | null;
  latestPercentage: number | null;
  lastActivity: string | null;
}

export async function fetchAllStudentsWithStats(): Promise<StudentWithStats[]> {
  const { data: students, error: studentsError } = await supabase
    .from('students')
    .select('*')
    .order('created_at', { ascending: false });

  if (studentsError) throw new Error(studentsError.message);
  if (!students || students.length === 0) return [];

  const studentList = students as Student[];
  const studentIds = studentList.map((s) => s.id);

  const { data: attempts, error: attemptsError } = await supabase
    .from('exam_attempts')
    .select('student_id, status, score, max_score, submitted_at, created_at')
    .in('student_id', studentIds)
    .order('created_at', { ascending: false });

  if (attemptsError) throw new Error(attemptsError.message);

  const attemptMap = new Map<string, typeof attempts>();
  (attempts ?? []).forEach((a) => {
    const arr = attemptMap.get(a.student_id) ?? [];
    arr.push(a);
    attemptMap.set(a.student_id, arr);
  });

  return studentList.map((student) => {
    const studentAttempts = attemptMap.get(student.id) ?? [];
    const attemptCount = studentAttempts.length;

    const submittedAttempts = studentAttempts.filter(
      (a) => a.status === 'submitted' || a.status === 'auto_submitted' || a.status === 'graded'
    );

    let latestScore: number | null = null;
    let latestMaxScore: number | null = null;
    let latestPercentage: number | null = null;

    if (submittedAttempts.length > 0) {
      const latest = submittedAttempts[0];
      latestScore = latest.score;
      latestMaxScore = latest.max_score;
      if (latest.score !== null && latest.max_score !== null && latest.max_score > 0) {
        latestPercentage = Math.round((latest.score / latest.max_score) * 100);
      }
    }

    const lastActivity = studentAttempts.length > 0
      ? (submittedAttempts[0]?.submitted_at ?? studentAttempts[0]?.created_at ?? null)
      : null;

    return {
      student,
      attemptCount,
      latestScore,
      latestMaxScore,
      latestPercentage,
      lastActivity,
    };
  });
}
