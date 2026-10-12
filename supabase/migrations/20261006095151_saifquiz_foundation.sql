/*
# SaifQuiz Foundation Schema (Phase 1 of 7)

## Overview
Creates the foundational database schema for the SaifQuiz electronic examination platform.
This migration establishes all 7 core tables with proper relationships, RLS policies,
and indexes — structured so future phases (exam engine, grading, recordings, reports)
can extend them safely without breaking changes.

## Tables Created
1. admins — admin profiles linked to Supabase Auth (email, phone, full_name, is_active)
2. students — student records entered by name + phone (no auth account)
3. exams — exam definitions (title, description, status, created_by)
4. questions — questions per exam (type, content, points, order_index)
5. exam_attempts — student exam attempts (status, started_at, submitted_at, score)
6. answers — individual answers within attempts (answer_text, is_correct)
7. recordings — camera/mic recording metadata (type, storage_path, duration)

## Security (RLS)
- admins: self read/update + admin-only read of all
- students: anon+authenticated insert/read; admin-only update/delete
- exams, questions: admin-only CRUD; published exams visible to all
- exam_attempts, answers, recordings: all read; anon insert; admin update/delete
- is_admin() SECURITY DEFINER function checks admin role server-side

## Indexes on all foreign keys + frequently queried columns
## updated_at triggers on all tables with that column
*/

-- ============================================================
-- TABLE: admins (must exist before is_admin function)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.admins (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  phone text,
  full_name text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- HELPER FUNCTION: is_admin
-- Checks if the current authenticated user has a row in admins table
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admins
    WHERE id = auth.uid()
  );
$$;

-- ============================================================
-- TABLE: students
-- ============================================================
CREATE TABLE IF NOT EXISTS public.students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  phone text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- TABLE: exams
-- ============================================================
CREATE TABLE IF NOT EXISTS public.exams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'closed')),
  created_by uuid REFERENCES public.admins(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- TABLE: questions
-- ============================================================
CREATE TABLE IF NOT EXISTS public.questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'multiple_choice' CHECK (type IN ('multiple_choice', 'true_false', 'short_answer')),
  content text NOT NULL,
  points numeric NOT NULL DEFAULT 1,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- TABLE: exam_attempts
-- ============================================================
CREATE TABLE IF NOT EXISTS public.exam_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'submitted', 'graded')),
  started_at timestamptz,
  submitted_at timestamptz,
  score numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- TABLE: answers
-- ============================================================
CREATE TABLE IF NOT EXISTS public.answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL REFERENCES public.exam_attempts(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  answer_text text,
  is_correct boolean,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- TABLE: recordings
-- ============================================================
CREATE TABLE IF NOT EXISTS public.recordings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL REFERENCES public.exam_attempts(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('camera', 'screen', 'audio')),
  storage_path text,
  duration_seconds integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recordings ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES: admins
-- ============================================================
DROP POLICY IF EXISTS "admins_select_own" ON public.admins;
CREATE POLICY "admins_select_own"
  ON public.admins FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "admins_update_own" ON public.admins;
CREATE POLICY "admins_update_own"
  ON public.admins FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "admins_select_all_if_admin" ON public.admins;
CREATE POLICY "admins_select_all_if_admin"
  ON public.admins FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- ============================================================
-- RLS POLICIES: students
-- ============================================================
DROP POLICY IF EXISTS "students_select_all" ON public.students;
CREATE POLICY "students_select_all"
  ON public.students FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "students_insert_all" ON public.students;
CREATE POLICY "students_insert_all"
  ON public.students FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "students_update_admin" ON public.students;
CREATE POLICY "students_update_admin"
  ON public.students FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "students_delete_admin" ON public.students;
CREATE POLICY "students_delete_admin"
  ON public.students FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ============================================================
-- RLS POLICIES: exams
-- ============================================================
DROP POLICY IF EXISTS "exams_select_published_or_admin" ON public.exams;
CREATE POLICY "exams_select_published_or_admin"
  ON public.exams FOR SELECT
  TO anon, authenticated
  USING (status = 'published' OR public.is_admin());

DROP POLICY IF EXISTS "exams_insert_admin" ON public.exams;
CREATE POLICY "exams_insert_admin"
  ON public.exams FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "exams_update_admin" ON public.exams;
CREATE POLICY "exams_update_admin"
  ON public.exams FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "exams_delete_admin" ON public.exams;
CREATE POLICY "exams_delete_admin"
  ON public.exams FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ============================================================
-- RLS POLICIES: questions
-- ============================================================
DROP POLICY IF EXISTS "questions_select_admin_or_published" ON public.questions;
CREATE POLICY "questions_select_admin_or_published"
  ON public.questions FOR SELECT
  TO anon, authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.exams
      WHERE exams.id = questions.exam_id
      AND exams.status = 'published'
    )
  );

DROP POLICY IF EXISTS "questions_insert_admin" ON public.questions;
CREATE POLICY "questions_insert_admin"
  ON public.questions FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "questions_update_admin" ON public.questions;
CREATE POLICY "questions_update_admin"
  ON public.questions FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "questions_delete_admin" ON public.questions;
CREATE POLICY "questions_delete_admin"
  ON public.questions FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ============================================================
-- RLS POLICIES: exam_attempts
-- ============================================================
DROP POLICY IF EXISTS "attempts_select_all" ON public.exam_attempts;
CREATE POLICY "attempts_select_all"
  ON public.exam_attempts FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "attempts_insert_all" ON public.exam_attempts;
CREATE POLICY "attempts_insert_all"
  ON public.exam_attempts FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "attempts_update_admin" ON public.exam_attempts;
CREATE POLICY "attempts_update_admin"
  ON public.exam_attempts FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "attempts_delete_admin" ON public.exam_attempts;
CREATE POLICY "attempts_delete_admin"
  ON public.exam_attempts FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ============================================================
-- RLS POLICIES: answers
-- ============================================================
DROP POLICY IF EXISTS "answers_select_all" ON public.answers;
CREATE POLICY "answers_select_all"
  ON public.answers FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "answers_insert_all" ON public.answers;
CREATE POLICY "answers_insert_all"
  ON public.answers FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "answers_update_admin" ON public.answers;
CREATE POLICY "answers_update_admin"
  ON public.answers FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "answers_delete_admin" ON public.answers;
CREATE POLICY "answers_delete_admin"
  ON public.answers FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ============================================================
-- RLS POLICIES: recordings
-- ============================================================
DROP POLICY IF EXISTS "recordings_select_all" ON public.recordings;
CREATE POLICY "recordings_select_all"
  ON public.recordings FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "recordings_insert_all" ON public.recordings;
CREATE POLICY "recordings_insert_all"
  ON public.recordings FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "recordings_update_admin" ON public.recordings;
CREATE POLICY "recordings_update_admin"
  ON public.recordings FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "recordings_delete_admin" ON public.recordings;
CREATE POLICY "recordings_delete_admin"
  ON public.recordings FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_students_phone ON public.students(phone);
CREATE INDEX IF NOT EXISTS idx_exams_created_by ON public.exams(created_by);
CREATE INDEX IF NOT EXISTS idx_exams_status ON public.exams(status);
CREATE INDEX IF NOT EXISTS idx_questions_exam_id ON public.questions(exam_id);
CREATE INDEX IF NOT EXISTS idx_attempts_exam_id ON public.exam_attempts(exam_id);
CREATE INDEX IF NOT EXISTS idx_attempts_student_id ON public.exam_attempts(student_id);
CREATE INDEX IF NOT EXISTS idx_answers_attempt_id ON public.answers(attempt_id);
CREATE INDEX IF NOT EXISTS idx_answers_question_id ON public.answers(question_id);
CREATE INDEX IF NOT EXISTS idx_recordings_attempt_id ON public.recordings(attempt_id);

-- ============================================================
-- UPDATED_AT TRIGGER FUNCTION + TRIGGERS
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'admins_updated_at') THEN
    CREATE TRIGGER admins_updated_at
      BEFORE UPDATE ON public.admins
      FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'students_updated_at') THEN
    CREATE TRIGGER students_updated_at
      BEFORE UPDATE ON public.students
      FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'exams_updated_at') THEN
    CREATE TRIGGER exams_updated_at
      BEFORE UPDATE ON public.exams
      FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'questions_updated_at') THEN
    CREATE TRIGGER questions_updated_at
      BEFORE UPDATE ON public.questions
      FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'exam_attempts_updated_at') THEN
    CREATE TRIGGER exam_attempts_updated_at
      BEFORE UPDATE ON public.exam_attempts
      FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'answers_updated_at') THEN
    CREATE TRIGGER answers_updated_at
      BEFORE UPDATE ON public.answers
      FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END;
$$;
