import { supabase } from '@/lib/supabase';
import type { Exam, ExamAttempt, StudentQuestion, Answer, CorrectAnswer, AttemptStatus } from '@/types';

export async function fetchActiveExams(): Promise<Exam[]> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('exams')
    .select('*')
    .eq('status', 'active')
    .or(`start_at.is.null,start_at.lte.${now}`)
    .or(`end_at.is.null,end_at.gte.${now}`)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as Exam[];
}

export async function fetchAttemptByStudentExam(
  studentId: string,
  examId: string
): Promise<ExamAttempt | null> {
  const { data, error } = await supabase
    .from('exam_attempts')
    .select('*')
    .eq('student_id', studentId)
    .eq('exam_id', examId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as ExamAttempt | null;
}

export interface ResumableExamAttempt {
  exam: Exam;
  attempt: ExamAttempt;
}

export async function fetchResumableExamAttempts(
  studentId: string
): Promise<ResumableExamAttempt[]> {
  const { data, error } = await supabase
    .from('exam_attempts')
    .select('*, exam:exams(*)')
    .eq('student_id', studentId)
    .eq('status', 'in_progress');

  if (error) throw new Error(error.message);

  return ((data ?? []) as unknown as (ExamAttempt & { exam: Exam | null })[])
    .filter((row): row is ExamAttempt & { exam: Exam } => row.exam !== null)
    .map(({ exam, ...attempt }) => ({ exam, attempt }));
}

export async function createAttempt(examId: string): Promise<ExamAttempt> {
  const { data, error } = await supabase.rpc('start_exam_attempt', {
    p_exam_id: examId,
  });
  if (error) throw new Error(error.message);
  const attempt = Array.isArray(data) ? data[0] : data;
  if (!attempt) throw new Error('تعذّر بدء محاولة الامتحان');
  return attempt as ExamAttempt;
}

export async function startExistingAttempt(examId: string): Promise<ExamAttempt> {
  return createAttempt(examId);
}

export async function fetchExamQuestions(examId: string): Promise<StudentQuestion[]> {
  const { data, error } = await supabase.rpc('get_student_exam_questions', {
    p_exam_id: examId,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as StudentQuestion[];
}

export async function fetchAttemptAnswers(attemptId: string): Promise<Answer[]> {
  const { data, error } = await supabase
    .from('answers')
    .select('*')
    .eq('attempt_id', attemptId);

  if (error) throw new Error(error.message);
  return (data ?? []) as Answer[];
}

export async function saveAnswer(
  attemptId: string,
  questionId: string,
  selectedAnswer: CorrectAnswer
): Promise<void> {
  const { error } = await supabase.rpc('save_student_answer', {
    p_attempt_id: attemptId,
    p_question_id: questionId,
    p_selected_answer: selectedAnswer,
  });
  if (error) throw new Error(error.message);
}

export interface GradingResult {
  score: number;
  max_score: number;
  percentage: number;
  graded_count: number;
  error?: string;
}

export async function submitAndGradeAttempt(
  attemptId: string,
  status: AttemptStatus = 'submitted'
): Promise<GradingResult> {
  const { data, error } = await supabase.rpc('grade_attempt', {
    p_attempt_id: attemptId,
    p_auto_submitted: status === 'auto_submitted',
  });

  if (error) throw new Error(error.message);

  const result = data as GradingResult;
  if (result.error) throw new Error(result.error);

  return result;
}

export async function isAttemptSubmittable(attempt: ExamAttempt): Promise<boolean> {
  return attempt.status === 'in_progress' || attempt.status === 'not_started';
}

export function hasAttemptBeenSubmitted(status: AttemptStatus): boolean {
  return status === 'submitted' || status === 'auto_submitted' || status === 'graded';
}

export function isAttemptExpired(attempt: ExamAttempt, examEndAt: string | null = null): boolean {
  const expiresAt = attempt.expires_at ?? examEndAt;
  return expiresAt !== null && new Date(expiresAt).getTime() <= Date.now();
}
