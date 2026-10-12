/*
# SaifQuiz Phase 4: Server Timer & Automatic Grading

## Overview
Adds server-based exam timer support and a SECURITY DEFINER grading function
that calculates scores server-side. The frontend never determines the final
score — all grading happens in the database.

## Changes to `exam_attempts` table
- Added `expires_at` (timestamptz, nullable) — when the attempt's time runs out.
  Set when the attempt starts, calculated from exam.duration_minutes.
  NULL means no time limit.
- Added `max_score` (numeric, nullable) — total possible points for the exam.
  Filled by the grading function.

## New function: `grade_attempt(attempt_uuid)`
- SECURITY DEFINER function that:
  1. Verifies the attempt exists
  2. Updates attempt status (submitted or auto_submitted)
  3. Sets submitted_at to now()
  4. Joins answers with questions to compare selected_answer vs correct_answer
  5. Sets is_correct on each answer row
  6. Calculates score = sum of points where is_correct = true
  7. Calculates max_score = sum of all question points
  8. Calculates percentage = (score / max_score) * 100
  9. Returns a JSON object with score, max_score, percentage, graded_count

## Security
- The grading function is SECURITY DEFINER so it can update is_correct on
  answer rows (which anon can't do via RLS — only admins can update answers)
- The function is callable by anon + authenticated (students need to call it
  when submitting their exam)
- The function only grades the specified attempt — no cross-attempt access
- RLS policies on answers remain: anon can insert/select, only admin can update
  The SECURITY DEFINER function bypasses RLS to set is_correct, which is the
  intended server-side grading pattern

## Important Notes
1. The grading function is idempotent — calling it on an already-graded
   attempt re-calculates the score from current answers.
2. expires_at is set by the frontend when creating the attempt, using the
   server timestamp from started_at + duration_minutes. The frontend reads
   expires_at to display the countdown.
3. max_score is stored on the attempt so it can be displayed even after
   questions are modified or deleted.
*/

-- ============================================================
-- EXAM_ATTEMPTS: Add expires_at and max_score columns
-- ============================================================
ALTER TABLE public.exam_attempts ADD COLUMN IF NOT EXISTS expires_at timestamptz;
ALTER TABLE public.exam_attempts ADD COLUMN IF NOT EXISTS max_score numeric;

-- ============================================================
-- GRADING FUNCTION: grade_attempt
-- SECURITY DEFINER — runs with elevated privileges to update answer rows
-- ============================================================
CREATE OR REPLACE FUNCTION public.grade_attempt(p_attempt_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attempt record;
  v_score numeric := 0;
  v_max_score numeric := 0;
  v_percentage numeric := 0;
  v_graded_count integer := 0;
  v_current_status text;
BEGIN
  -- Lock and load the attempt
  SELECT * INTO v_attempt
  FROM public.exam_attempts
  WHERE id = p_attempt_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Attempt not found');
  END IF;

  v_current_status := v_attempt.status;

  -- Don't re-grade if already graded (idempotency: allow re-grade for submitted/auto_submitted)
  -- But allow grading from in_progress, submitted, or auto_submitted states

  -- Mark is_correct on all answer rows for this attempt
  UPDATE public.answers AS a
  SET is_correct = (
    a.selected_answer IS NOT NULL
    AND a.selected_answer = q.correct_answer
  )
  FROM public.questions AS q
  WHERE a.question_id = q.id
    AND a.attempt_id = p_attempt_id;

  -- Calculate score and max_score
  SELECT
    COALESCE(SUM(CASE WHEN a.is_correct THEN q.points ELSE 0 END), 0),
    COALESCE(SUM(q.points), 0),
    COUNT(CASE WHEN a.selected_answer IS NOT NULL THEN 1 END)
  INTO v_score, v_max_score, v_graded_count
  FROM public.answers AS a
  JOIN public.questions AS q ON a.question_id = q.id
  WHERE a.attempt_id = p_attempt_id;

  -- Calculate percentage (avoid division by zero)
  IF v_max_score > 0 THEN
    v_percentage := ROUND((v_score / v_max_score) * 100, 2);
  ELSE
    v_percentage := 0;
  END IF;

  -- Update the attempt with score, max_score, and submission info
  UPDATE public.exam_attempts
  SET
    score = v_score,
    max_score = v_max_score,
    submitted_at = COALESCE(submitted_at, now()),
    status = CASE
      WHEN v_current_status = 'auto_submitted' THEN 'auto_submitted'
      ELSE 'submitted'
    END
  WHERE id = p_attempt_id;

  RETURN json_build_object(
    'score', v_score,
    'max_score', v_max_score,
    'percentage', v_percentage,
    'graded_count', v_graded_count
  );
END;
$$;

-- Grant execute on grading function to anon and authenticated
GRANT EXECUTE ON FUNCTION public.grade_attempt(uuid) TO anon, authenticated;
