import { supabase } from '@/lib/supabase';
import type { ExamAttempt, AttemptStatus, Student, Exam, Question, Answer, Recording } from '@/types';

export interface ResultRow {
  attempt: ExamAttempt;
  student: Student;
  exam: Exam;
}

export interface ResultFilters {
  examId?: string | null;
  studentName?: string | null;
  phone?: string | null;
  status?: AttemptStatus | null;
  minScore?: number | null;
}

export interface RecentActivity {
  attemptId: string;
  status: AttemptStatus;
  submittedAt: string;
  studentName: string;
  examTitle: string;
}

async function finalizeExpiredAttempts(): Promise<void> {
  const { error } = await supabase.rpc('finalize_expired_attempts');
  if (error) throw new Error(error.message);
}

export async function fetchRecentActivity(): Promise<RecentActivity[]> {
  await finalizeExpiredAttempts();
  const { data, error } = await supabase
    .from('exam_attempts')
    .select(`
      id,
      status,
      submitted_at,
      student:students(full_name),
      exam:exams(title)
    `)
    .not('submitted_at', 'is', null)
    .order('submitted_at', { ascending: false })
    .limit(5);

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const joined = row as unknown as {
      id: string;
      status: AttemptStatus;
      submitted_at: string;
      student: { full_name: string } | null;
      exam: { title: string } | null;
    };
    return {
      attemptId: joined.id,
      status: joined.status,
      submittedAt: joined.submitted_at,
      studentName: joined.student?.full_name ?? '—',
      examTitle: joined.exam?.title ?? '—',
    };
  });
}

const SUBMITTED_STATUSES: AttemptStatus[] = ['submitted', 'auto_submitted', 'graded'];

export async function fetchAllResults(filters: ResultFilters = {}): Promise<ResultRow[]> {
  await finalizeExpiredAttempts();
  let query = supabase
    .from('exam_attempts')
    .select(`
      *,
      student:students(*),
      exam:exams(*)
    `)
    .in('status', SUBMITTED_STATUSES)
    .order('submitted_at', { ascending: false, nullsFirst: false });

  if (filters.examId) {
    query = query.eq('exam_id', filters.examId);
  }
  if (filters.status) {
    query = query.eq('status', filters.status);
  }

  const { data, error } = await query;

  if (error) throw new Error(error.message);

  let rows = (data ?? []) as unknown as ResultRow[];

  // Client-side filtering for student name, phone, minScore (since these are on joined tables)
  if (filters.studentName) {
    const q = filters.studentName.toLowerCase();
    rows = rows.filter((r) => r.student?.full_name?.toLowerCase().includes(q));
  }
  if (filters.phone) {
    const p = filters.phone.toLowerCase();
    rows = rows.filter((r) => r.student?.phone?.toLowerCase().includes(p));
  }
  if (filters.minScore !== null && filters.minScore !== undefined) {
    rows = rows.filter((r) => (r.attempt.score ?? 0) >= (filters.minScore ?? 0));
  }

  return rows;
}

export interface AttemptDetail {
  attempt: ExamAttempt;
  student: Student;
  exam: Exam;
  questions: Question[];
  answers: Answer[];
  recordings: Recording[];
}

export async function fetchAttemptDetail(attemptId: string): Promise<AttemptDetail> {
  const { data: attempt, error: attemptError } = await supabase
    .from('exam_attempts')
    .select(`
      *,
      student:students(*),
      exam:exams(*)
    `)
    .eq('id', attemptId)
    .single();

  if (attemptError) throw new Error(attemptError.message);

  const attemptData = attempt as unknown as { id: string; student: Student; exam: Exam } & ExamAttempt;

  const [questionsResult, answersResult, recordingsResult] = await Promise.all([
    supabase.from('questions').select('*').eq('exam_id', attemptData.exam_id).order('order_index', { ascending: true }),
    supabase.from('answers').select('*').eq('attempt_id', attemptId),
    supabase.from('recordings').select('*').eq('attempt_id', attemptId).order('created_at', { ascending: true }),
  ]);

  if (questionsResult.error) throw new Error(questionsResult.error.message);
  if (answersResult.error) throw new Error(answersResult.error.message);
  if (recordingsResult.error) throw new Error(recordingsResult.error.message);

  return {
    attempt: attemptData,
    student: attemptData.student,
    exam: attemptData.exam,
    questions: (questionsResult.data ?? []) as Question[],
    answers: (answersResult.data ?? []) as Answer[],
    recordings: (recordingsResult.data ?? []) as Recording[],
  };
}

export interface ExamStatistics {
  totalStudents: number;
  started: number;
  submitted: number;
  autoSubmitted: number;
  averageScore: number | null;
  highestScore: number | null;
  lowestScore: number | null;
  passRate: number | null;
}

export async function fetchExamStatistics(examId: string, passThreshold: number = 50): Promise<ExamStatistics> {
  await finalizeExpiredAttempts();
  const { data, error } = await supabase
    .from('exam_attempts')
    .select('status, score, max_score')
    .eq('exam_id', examId);

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as { status: AttemptStatus; score: number | null; max_score: number | null }[];

  const totalStudents = new Set(rows.map((r) => r)).size; // unique attempts
  const started = rows.length;
  const submittedRows = rows.filter((r) => r.status === 'submitted' || r.status === 'graded');
  const autoSubmittedRows = rows.filter((r) => r.status === 'auto_submitted');
  const submitted = submittedRows.length + autoSubmittedRows.length;

  const scoredRows = [...submittedRows, ...autoSubmittedRows].filter((r) => r.score !== null && r.max_score !== null && r.max_score > 0);

  let averageScore: number | null = null;
  let highestScore: number | null = null;
  let lowestScore: number | null = null;
  let passRate: number | null = null;

  if (scoredRows.length > 0) {
    const percentages = scoredRows.map((r) => (r.score! / r.max_score!) * 100);
    const sum = percentages.reduce((a, b) => a + b, 0);
    averageScore = Math.round((sum / percentages.length) * 100) / 100;
    highestScore = Math.max(...percentages);
    lowestScore = Math.min(...percentages);
    const passed = percentages.filter((p) => p >= passThreshold).length;
    passRate = Math.round((passed / percentages.length) * 100);
  }

  return {
    totalStudents,
    started,
    submitted,
    autoSubmitted: autoSubmittedRows.length,
    averageScore,
    highestScore,
    lowestScore,
    passRate,
  };
}

export async function fetchAllExams(): Promise<Exam[]> {
  const { data, error } = await supabase
    .from('exams')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as Exam[];
}
