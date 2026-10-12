import { supabase } from '@/lib/supabase';
import type { Question, QuestionInput } from '@/types';

export async function fetchQuestions(examId: string): Promise<Question[]> {
  const { data, error } = await supabase
    .from('questions')
    .select('*')
    .eq('exam_id', examId)
    .order('order_index', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as Question[];
}

export async function createQuestion(examId: string, input: QuestionInput): Promise<Question> {
  const { data, error } = await supabase
    .from('questions')
    .insert({
      exam_id: examId,
      question_text: input.question_text,
      content: input.question_text,
      choice_a: input.choice_a,
      choice_b: input.choice_b,
      choice_c: input.choice_c,
      choice_d: input.choice_d,
      correct_answer: input.correct_answer,
      points: input.points,
      order_index: input.order_index,
      type: 'multiple_choice',
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Question;
}

export async function updateQuestion(id: string, input: Partial<QuestionInput>): Promise<Question> {
  const { data, error } = await supabase
    .from('questions')
    .update({
      ...(input.question_text !== undefined && { question_text: input.question_text }),
      ...(input.question_text !== undefined && { content: input.question_text }),
      ...(input.choice_a !== undefined && { choice_a: input.choice_a }),
      ...(input.choice_b !== undefined && { choice_b: input.choice_b }),
      ...(input.choice_c !== undefined && { choice_c: input.choice_c }),
      ...(input.choice_d !== undefined && { choice_d: input.choice_d }),
      ...(input.correct_answer !== undefined && { correct_answer: input.correct_answer }),
      ...(input.points !== undefined && { points: input.points }),
      ...(input.order_index !== undefined && { order_index: input.order_index }),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Question;
}

export async function deleteQuestion(id: string): Promise<void> {
  const { error } = await supabase.from('questions').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function reorderQuestions(examId: string, orderedIds: string[]): Promise<void> {
  const updates = orderedIds.map((id, index) =>
    supabase.from('questions').update({ order_index: index }).eq('id', id)
  );

  const results = await Promise.all(updates);
  const failed = results.find((r) => r.error);
  if (failed?.error) throw new Error(failed.error.message);
}

export async function countQuestions(examId: string): Promise<number> {
  const { count, error } = await supabase
    .from('questions')
    .select('*', { count: 'exact', head: true })
    .eq('exam_id', examId);

  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function countAllQuestions(): Promise<number> {
  const { count, error } = await supabase
    .from('questions')
    .select('id', { count: 'exact', head: true });

  if (error) throw new Error(error.message);
  return count ?? 0;
}
