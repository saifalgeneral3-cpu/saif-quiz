/*
# SaifQuiz Phase 3: Student Exam Engine Schema

## Overview
Extends the exam_attempts and answers tables to support the real student
exam engine. Adds the auto_submitted attempt status, a selected_answer
column on answers, and a database-level unique constraint to enforce
one attempt per student per exam.

## Changes to `exam_attempts` table
- Status constraint updated: old values (not_started, in_progress, submitted, graded)
  are replaced with (not_started, in_progress, submitted, auto_submitted, graded)
  - auto_submitted: attempt was force-submitted because the student left the exam page
- Added unique constraint on (exam_id, student_id) to enforce one attempt per exam
  per student at the database level — not just frontend

## Changes to `answers` table
- Added `selected_answer` (text, nullable) — stores 'A', 'B', 'C', or 'D'
  This is separate from answer_text (which can hold free-text in future phases)
  and from is_correct (which is set during grading in Phase 4)

## Security
- RLS policies remain unchanged — anon can insert/select answers and attempts
- The unique constraint is the key security improvement: even if a student
  tries to create a second attempt via direct API call, the database rejects it

## Important Notes
1. The unique constraint on (exam_id, student_id) means once a student has
   any attempt record for an exam (regardless of status), no new attempt can
   be created. This is by design — one attempt per exam per student.
2. The auto_submitted status lets Phase 4 grading distinguish voluntary
   submissions from forced ones.
3. selected_answer is nullable to allow questions the student hasn't answered yet.
*/

-- ============================================================
-- EXAM_ATTEMPTS: Update status constraint to include auto_submitted
-- ============================================================
ALTER TABLE public.exam_attempts DROP CONSTRAINT IF EXISTS exam_attempts_status_check;
ALTER TABLE public.exam_attempts DROP CONSTRAINT IF EXISTS exam_attempts_status_check1;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'exam_attempts_status_check'
    AND conrelid = 'public.exam_attempts'::regclass
  ) THEN
    ALTER TABLE public.exam_attempts
      ADD CONSTRAINT exam_attempts_status_check
      CHECK (status IN ('not_started', 'in_progress', 'submitted', 'auto_submitted', 'graded'));
  END IF;
END $$;

-- ============================================================
-- EXAM_ATTEMPTS: Unique constraint — one attempt per student per exam
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'unique_attempt_per_student_exam'
    AND conrelid = 'public.exam_attempts'::regclass
  ) THEN
    ALTER TABLE public.exam_attempts
      ADD CONSTRAINT unique_attempt_per_student_exam
      UNIQUE (exam_id, student_id);
  END IF;
END $$;

-- ============================================================
-- ANSWERS: Add selected_answer column
-- ============================================================
ALTER TABLE public.answers ADD COLUMN IF NOT EXISTS selected_answer text;

-- ============================================================
-- ANSWERS: Add CHECK constraint for selected_answer values
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'answers_selected_answer_check'
    AND conrelid = 'public.answers'::regclass
  ) THEN
    ALTER TABLE public.answers
      ADD CONSTRAINT answers_selected_answer_check
      CHECK (selected_answer IS NULL OR selected_answer IN ('A', 'B', 'C', 'D'));
  END IF;
END $$;

-- ============================================================
-- INDEX: Unique index on (attempt_id, question_id) for upsert support
-- Each question in an attempt has exactly one answer row
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_answers_attempt_question_unique
  ON public.answers (attempt_id, question_id);
