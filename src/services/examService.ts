import { supabase } from '@/lib/supabase';
import type { Exam, ExamInput, ExamStatus } from '@/types';

export async function fetchExams(): Promise<Exam[]> {
  const { data, error } = await supabase
    .from('exams')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as Exam[];
}

export async function fetchExamById(id: string): Promise<Exam | null> {
  const { data, error } = await supabase
    .from('exams')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as Exam | null;
}

export async function createExam(input: ExamInput, adminId: string): Promise<Exam> {
  const { data, error } = await supabase
    .from('exams')
    .insert({
      title: input.title,
      description: input.description,
      duration_minutes: input.duration_minutes,
      status: input.status,
      start_at: input.start_at,
      end_at: input.end_at,
      created_by: adminId,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Exam;
}

export async function updateExam(id: string, input: Partial<ExamInput>): Promise<Exam> {
  const { data, error } = await supabase
    .from('exams')
    .update({
      ...(input.title !== undefined && { title: input.title }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.duration_minutes !== undefined && { duration_minutes: input.duration_minutes }),
      ...(input.status !== undefined && { status: input.status }),
      ...(input.start_at !== undefined && { start_at: input.start_at }),
      ...(input.end_at !== undefined && { end_at: input.end_at }),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Exam;
}

export async function deleteExam(id: string): Promise<void> {
  const { error } = await supabase.from('exams').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function updateExamStatus(id: string, status: ExamStatus): Promise<void> {
  const { error } = await supabase.from('exams').update({ status }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function countExamsByStatus(): Promise<Record<ExamStatus, number>> {
  const { data, error } = await supabase
    .from('exams')
    .select('status');

  if (error) throw new Error(error.message);

  const counts: Record<ExamStatus, number> = {
    draft: 0,
    active: 0,
    inactive: 0,
    finished: 0,
  };

  (data ?? []).forEach((row: { status: ExamStatus }) => {
    if (row.status in counts) counts[row.status]++;
  });

  return counts;
}
