/*
# SaifQuiz Phase 2: Exam Management & Question Builder Schema

## Overview
Extends the Phase 1 schema to support full exam management and a structured
question builder with four choices per question. This migration is additive —
no existing columns are dropped or renamed destructively.

## Changes to `exams` table
- Added `duration_minutes` (integer, nullable) — exam time limit in minutes
- Added `start_at` (timestamptz, nullable) — when the exam becomes available
- Added `end_at` (timestamptz, nullable) — when the exam closes
- Replaced the status CHECK constraint: old values (draft, published, closed)
  are replaced with (draft, active, inactive, finished)
  - draft: exam is being built, not visible to students
  - active: exam is live and available to students
  - inactive: exam is temporarily paused
  - finished: exam is over, no more attempts allowed

## Changes to `questions` table
- Added `question_text` (text, NOT NULL) — replaces `content` for clarity
  (content column is kept for backward compatibility but new code uses question_text)
- Added `choice_a` (text, NOT NULL) — first choice
- Added `choice_b` (text, NOT NULL) — second choice
- Added `choice_c` (text, NOT NULL) — third choice
- Added `choice_d` (text, NOT NULL) — fourth choice
- Added `correct_answer` (text, NOT NULL) — one of 'A', 'B', 'C', 'D'
- Added CHECK constraint on correct_answer to enforce valid values
- Dropped the old `type` CHECK constraint since all questions are now
  structured multiple-choice with 4 options (type column retained for
  future extensibility but no longer constrained)

## Data Migration
- Copies any existing `content` values into `question_text` (for continuity)
- Existing rows get default values for new NOT NULL columns where needed

## Security
- RLS policies remain unchanged — admin-only CRUD on exams and questions
- No policy changes needed

## Important Notes
1. The `content` column on questions is retained but deprecated. New code
   writes to `question_text`. A future migration may drop `content`.
2. The old status values (published, closed) are no longer valid. Any
   existing exams with those statuses are migrated to 'inactive' and
   'finished' respectively.
3. `duration_minutes` is nullable to support exams without a time limit.
*/

-- ============================================================
-- EXAMS: Add new columns
-- ============================================================
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS duration_minutes integer;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS start_at timestamptz;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS end_at timestamptz;

-- ============================================================
-- EXAMS: Migrate old status values before changing constraint
-- ============================================================
UPDATE public.exams SET status = 'inactive' WHERE status = 'published';
UPDATE public.exams SET status = 'finished' WHERE status = 'closed';

-- ============================================================
-- EXAMS: Replace status CHECK constraint
-- ============================================================
ALTER TABLE public.exams DROP CONSTRAINT IF EXISTS exams_status_check;
ALTER TABLE public.exams DROP CONSTRAINT IF EXISTS exams_status_check1;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'exams_status_check'
    AND conrelid = 'public.exams'::regclass
  ) THEN
    ALTER TABLE public.exams
      ADD CONSTRAINT exams_status_check
      CHECK (status IN ('draft', 'active', 'inactive', 'finished'));
  END IF;
END $$;

-- ============================================================
-- QUESTIONS: Add new columns for 4-choice MCQ format
-- ============================================================
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS question_text text;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS choice_a text;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS choice_b text;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS choice_c text;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS choice_d text;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS correct_answer text;

-- ============================================================
-- QUESTIONS: Copy content -> question_text for existing rows
-- ============================================================
UPDATE public.questions SET question_text = content WHERE question_text IS NULL AND content IS NOT NULL;

-- ============================================================
-- QUESTIONS: Set defaults for new NOT NULL columns on existing rows
-- ============================================================
UPDATE public.questions SET choice_a = '—' WHERE choice_a IS NULL;
UPDATE public.questions SET choice_b = '—' WHERE choice_b IS NULL;
UPDATE public.questions SET choice_c = '—' WHERE choice_c IS NULL;
UPDATE public.questions SET choice_d = '—' WHERE choice_d IS NULL;
UPDATE public.questions SET correct_answer = 'A' WHERE correct_answer IS NULL;
UPDATE public.questions SET question_text = 'سؤال بدون نص' WHERE question_text IS NULL;

-- ============================================================
-- QUESTIONS: Enforce NOT NULL on new columns
-- ============================================================
ALTER TABLE public.questions ALTER COLUMN question_text SET NOT NULL;
ALTER TABLE public.questions ALTER COLUMN choice_a SET NOT NULL;
ALTER TABLE public.questions ALTER COLUMN choice_b SET NOT NULL;
ALTER TABLE public.questions ALTER COLUMN choice_c SET NOT NULL;
ALTER TABLE public.questions ALTER COLUMN choice_d SET NOT NULL;
ALTER TABLE public.questions ALTER COLUMN correct_answer SET NOT NULL;

-- ============================================================
-- QUESTIONS: Add correct_answer CHECK constraint
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'questions_correct_answer_check'
    AND conrelid = 'public.questions'::regclass
  ) THEN
    ALTER TABLE public.questions
      ADD CONSTRAINT questions_correct_answer_check
      CHECK (correct_answer IN ('A', 'B', 'C', 'D'));
  END IF;
END $$;

-- ============================================================
-- QUESTIONS: Drop old type CHECK constraint (no longer needed)
-- ============================================================
ALTER TABLE public.questions DROP CONSTRAINT IF EXISTS questions_type_check;

-- ============================================================
-- INDEXES: Add useful indexes for exam management queries
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_exams_start_at ON public.exams(start_at);
CREATE INDEX IF NOT EXISTS idx_questions_order ON public.questions(exam_id, order_index);
