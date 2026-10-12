CREATE OR REPLACE FUNCTION public.normalize_student_phone(p_phone text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
STRICT
SET search_path = public
AS $$
DECLARE
  v_digits text := regexp_replace(p_phone, '[^0-9]', '', 'g');
BEGIN
  IF left(p_phone, 1) = '+' OR left(v_digits, 3) = '964' THEN
    RETURN '+' || v_digits;
  END IF;

  IF left(v_digits, 1) = '0' THEN
    RETURN '+964' || substr(v_digits, 2);
  END IF;

  RETURN '+964' || v_digits;
END;
$$;

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_students_auth_user_id
  ON public.students(auth_user_id)
  WHERE auth_user_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'exams_duration_minutes_positive'
      AND conrelid = 'public.exams'::regclass
  ) THEN
    ALTER TABLE public.exams
      ADD CONSTRAINT exams_duration_minutes_positive
      CHECK (duration_minutes IS NULL OR duration_minutes > 0) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'questions_points_positive'
      AND conrelid = 'public.questions'::regclass
  ) THEN
    ALTER TABLE public.questions
      ADD CONSTRAINT questions_points_positive
      CHECK (points > 0) NOT VALID;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admins
    WHERE id = auth.uid()
      AND is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.register_student(p_full_name text)
RETURNS SETOF public.students
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_phone text;
  v_student public.students%ROWTYPE;
  v_matches integer;
BEGIN
  IF v_user_id IS NULL
     OR p_full_name IS NULL
     OR length(trim(p_full_name)) < 3
     OR length(trim(p_full_name)) > 200
     OR trim(p_full_name) !~ '^[ء-ي[:space:]]+$'
     OR cardinality(regexp_split_to_array(trim(p_full_name), '[[:space:]]+')) < 3 THEN
    RAISE EXCEPTION 'بيانات الطالب غير صالحة';
  END IF;

  SELECT public.normalize_student_phone(u.phone)
  INTO v_phone
  FROM auth.users AS u
  WHERE u.id = v_user_id
    AND u.phone_confirmed_at IS NOT NULL;

  IF v_phone IS NULL THEN
    RAISE EXCEPTION 'يجب تأكيد رقم الهاتف أولاً';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_phone, 0));

  SELECT count(*) INTO v_matches
  FROM public.students AS s
  WHERE public.normalize_student_phone(s.phone) = v_phone;

  IF v_matches > 1 THEN
    RAISE EXCEPTION 'توجد سجلات متعددة لهذا الرقم. يرجى التواصل مع الإدارة';
  END IF;

  SELECT * INTO v_student
  FROM public.students AS s
  WHERE public.normalize_student_phone(s.phone) = v_phone
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    IF v_student.auth_user_id IS NOT NULL AND v_student.auth_user_id <> v_user_id THEN
      RAISE EXCEPTION 'رقم الهاتف مرتبط بحساب طالب آخر';
    END IF;

    UPDATE public.students
    SET auth_user_id = v_user_id,
        full_name = trim(p_full_name),
        phone = v_phone
    WHERE id = v_student.id
    RETURNING * INTO v_student;
  ELSE
    INSERT INTO public.students (auth_user_id, full_name, phone)
    VALUES (v_user_id, trim(p_full_name), v_phone)
    RETURNING * INTO v_student;
  END IF;

  RETURN NEXT v_student;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_student_attempt_owner(p_attempt_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.exam_attempts AS a
    JOIN public.students AS s ON s.id = a.student_id
    WHERE a.id = p_attempt_id
      AND s.auth_user_id = auth.uid()
  );
$$;

DROP POLICY IF EXISTS "admins_update_own" ON public.admins;

DROP POLICY IF EXISTS "students_select_all" ON public.students;
DROP POLICY IF EXISTS "students_insert_all" ON public.students;
DROP POLICY IF EXISTS "students_update_admin" ON public.students;
DROP POLICY IF EXISTS "students_delete_admin" ON public.students;
DROP POLICY IF EXISTS "students_select_admin_or_self" ON public.students;
DROP POLICY IF EXISTS "students_insert_admin" ON public.students;
DROP POLICY IF EXISTS "students_delete_admin" ON public.students;
CREATE POLICY "students_select_admin_or_self"
  ON public.students FOR SELECT
  TO authenticated
  USING (public.is_admin() OR auth_user_id = auth.uid());
CREATE POLICY "students_insert_admin"
  ON public.students FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());
CREATE POLICY "students_update_admin"
  ON public.students FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
CREATE POLICY "students_delete_admin"
  ON public.students FOR DELETE
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "exams_select_published_or_admin" ON public.exams;
DROP POLICY IF EXISTS "exams_select_active_or_admin" ON public.exams;
CREATE POLICY "exams_select_active_or_admin"
  ON public.exams FOR SELECT
  TO anon, authenticated
  USING (
    public.is_admin()
    OR (
      status = 'active'
      AND (start_at IS NULL OR start_at <= now())
      AND (end_at IS NULL OR end_at > now())
    )
    OR EXISTS (
      SELECT 1
      FROM public.exam_attempts AS a
      JOIN public.students AS s ON s.id = a.student_id
      WHERE a.exam_id = exams.id
        AND s.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "questions_select_admin_or_published" ON public.questions;
DROP POLICY IF EXISTS "questions_select_admin_only" ON public.questions;
CREATE POLICY "questions_select_admin_only"
  ON public.questions FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "attempts_select_all" ON public.exam_attempts;
DROP POLICY IF EXISTS "attempts_insert_all" ON public.exam_attempts;
DROP POLICY IF EXISTS "attempts_update_admin" ON public.exam_attempts;
DROP POLICY IF EXISTS "attempts_select_admin_or_owner" ON public.exam_attempts;
CREATE POLICY "attempts_select_admin_or_owner"
  ON public.exam_attempts FOR SELECT
  TO authenticated
  USING (public.is_admin() OR public.is_student_attempt_owner(id));
CREATE POLICY "attempts_update_admin"
  ON public.exam_attempts FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "answers_select_all" ON public.answers;
DROP POLICY IF EXISTS "answers_insert_all" ON public.answers;
DROP POLICY IF EXISTS "answers_update_admin" ON public.answers;
DROP POLICY IF EXISTS "answers_select_admin_or_owner" ON public.answers;
CREATE POLICY "answers_select_admin_or_owner"
  ON public.answers FOR SELECT
  TO authenticated
  USING (public.is_admin() OR public.is_student_attempt_owner(attempt_id));
CREATE POLICY "answers_update_admin"
  ON public.answers FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "recordings_select_all" ON public.recordings;
DROP POLICY IF EXISTS "recordings_select_admin" ON public.recordings;
DROP POLICY IF EXISTS "recordings_insert_all" ON public.recordings;
CREATE POLICY "recordings_select_admin"
  ON public.recordings FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.get_student_exam_questions(p_exam_id uuid)
RETURNS TABLE (
  id uuid,
  exam_id uuid,
  type text,
  question_text text,
  content text,
  choice_a text,
  choice_b text,
  choice_c text,
  choice_d text,
  points numeric,
  order_index integer,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.students WHERE auth_user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'يجب تسجيل دخول الطالب';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.exams AS e
    WHERE e.id = p_exam_id
      AND (
        (
          e.status = 'active'
          AND (e.start_at IS NULL OR e.start_at <= now())
          AND (e.end_at IS NULL OR e.end_at > now())
        )
        OR EXISTS (
          SELECT 1
          FROM public.exam_attempts AS a
          JOIN public.students AS s ON s.id = a.student_id
          WHERE a.exam_id = e.id
            AND s.auth_user_id = auth.uid()
            AND a.status = 'in_progress'
        )
      )
  ) THEN
    RAISE EXCEPTION 'هذا الامتحان غير متاح حالياً';
  END IF;

  RETURN QUERY
  SELECT q.id, q.exam_id, q.type, q.question_text, q.content,
         q.choice_a, q.choice_b, q.choice_c, q.choice_d,
         q.points, q.order_index, q.created_at, q.updated_at
  FROM public.questions AS q
  WHERE q.exam_id = p_exam_id
  ORDER BY q.order_index;
END;
$$;

CREATE OR REPLACE FUNCTION public.start_exam_attempt(p_exam_id uuid)
RETURNS SETOF public.exam_attempts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id uuid;
  v_exam public.exams%ROWTYPE;
  v_attempt public.exam_attempts%ROWTYPE;
  v_started_at timestamptz := now();
BEGIN
  SELECT id INTO v_student_id
  FROM public.students
  WHERE auth_user_id = auth.uid();

  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'يجب تسجيل دخول الطالب';
  END IF;

  SELECT * INTO v_exam
  FROM public.exams
  WHERE id = p_exam_id
    AND status = 'active'
    AND (start_at IS NULL OR start_at <= v_started_at)
    AND (end_at IS NULL OR end_at > v_started_at);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'هذا الامتحان غير متاح حالياً';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.questions WHERE exam_id = p_exam_id) THEN
    RAISE EXCEPTION 'لا يمكن بدء امتحان بلا أسئلة';
  END IF;

  IF v_exam.duration_minutes IS NOT NULL AND v_exam.duration_minutes <= 0 THEN
    RAISE EXCEPTION 'مدة الامتحان غير صالحة';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_student_id::text || ':' || p_exam_id::text, 0));

  SELECT * INTO v_attempt
  FROM public.exam_attempts
  WHERE exam_id = p_exam_id AND student_id = v_student_id
  FOR UPDATE;

  IF FOUND THEN
    IF v_attempt.status IN ('submitted', 'auto_submitted', 'graded') THEN
      RAISE EXCEPTION 'لقد تم تسليم هذا الامتحان بالفعل';
    END IF;

    IF v_attempt.status = 'not_started' THEN
      UPDATE public.exam_attempts
      SET status = 'in_progress',
          started_at = v_started_at,
          expires_at = CASE
        WHEN v_exam.end_at IS NULL AND v_exam.duration_minutes IS NULL THEN NULL
        WHEN v_exam.end_at IS NULL THEN v_started_at + make_interval(mins => v_exam.duration_minutes)
        WHEN v_exam.duration_minutes IS NULL THEN v_exam.end_at
        ELSE LEAST(v_exam.end_at, v_started_at + make_interval(mins => v_exam.duration_minutes))
      END
      WHERE id = v_attempt.id
      RETURNING * INTO v_attempt;
    END IF;

    RETURN NEXT v_attempt;
    RETURN;
  END IF;

  INSERT INTO public.exam_attempts (
    exam_id, student_id, status, started_at, expires_at
  )
  VALUES (
    p_exam_id,
    v_student_id,
    'in_progress',
    v_started_at,
    CASE
      WHEN v_exam.end_at IS NULL AND v_exam.duration_minutes IS NULL THEN NULL
      WHEN v_exam.end_at IS NULL THEN v_started_at + make_interval(mins => v_exam.duration_minutes)
      WHEN v_exam.duration_minutes IS NULL THEN v_exam.end_at
      ELSE LEAST(v_exam.end_at, v_started_at + make_interval(mins => v_exam.duration_minutes))
    END
  )
  RETURNING * INTO v_attempt;

  RETURN NEXT v_attempt;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_student_answer(
  p_attempt_id uuid,
  p_question_id uuid,
  p_selected_answer text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attempt public.exam_attempts%ROWTYPE;
  v_exam_end_at timestamptz;
BEGIN
  IF p_selected_answer IS NULL
     OR p_selected_answer NOT IN ('A', 'B', 'C', 'D') THEN
    RAISE EXCEPTION 'الإجابة غير صالحة';
  END IF;

  SELECT a.* INTO v_attempt
  FROM public.exam_attempts AS a
  JOIN public.students AS s ON s.id = a.student_id
  WHERE a.id = p_attempt_id
    AND s.auth_user_id = auth.uid()
  FOR UPDATE OF a;

  IF NOT FOUND OR v_attempt.status <> 'in_progress' THEN
    RAISE EXCEPTION 'المحاولة غير متاحة للإجابة';
  END IF;

  IF v_attempt.expires_at IS NOT NULL AND v_attempt.expires_at <= now() THEN
    RAISE EXCEPTION 'انتهى وقت الامتحان';
  END IF;

  SELECT end_at INTO v_exam_end_at
  FROM public.exams
  WHERE id = v_attempt.exam_id;
  IF v_exam_end_at IS NOT NULL AND v_exam_end_at <= now() THEN
    RAISE EXCEPTION 'انتهى وقت الامتحان';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.questions
    WHERE id = p_question_id AND exam_id = v_attempt.exam_id
  ) THEN
    RAISE EXCEPTION 'السؤال لا يتبع هذا الامتحان';
  END IF;

  INSERT INTO public.answers (attempt_id, question_id, selected_answer)
  VALUES (p_attempt_id, p_question_id, p_selected_answer)
  ON CONFLICT (attempt_id, question_id)
  DO UPDATE SET selected_answer = EXCLUDED.selected_answer,
                updated_at = now();
END;
$$;

DROP FUNCTION IF EXISTS public.grade_attempt(uuid);
CREATE OR REPLACE FUNCTION public.grade_attempt(p_attempt_id uuid, p_auto_submitted boolean DEFAULT false)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attempt public.exam_attempts%ROWTYPE;
  v_score numeric;
  v_max_score numeric;
  v_graded_count integer;
  v_final_status text;
  v_exam_end_at timestamptz;
BEGIN
  SELECT * INTO v_attempt
  FROM public.exam_attempts
  WHERE id = p_attempt_id
    AND (
      public.is_admin()
      OR EXISTS (
        SELECT 1
        FROM public.students AS s
        WHERE s.id = exam_attempts.student_id
          AND s.auth_user_id = auth.uid()
      )
    )
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'المحاولة غير موجودة';
  END IF;

  IF v_attempt.status IN ('submitted', 'auto_submitted', 'graded') THEN
    RETURN json_build_object(
      'score', v_attempt.score,
      'max_score', v_attempt.max_score,
      'percentage', CASE
        WHEN COALESCE(v_attempt.max_score, 0) > 0
          THEN round((v_attempt.score / v_attempt.max_score) * 100, 2)
        ELSE 0
      END,
      'graded_count', (
        SELECT count(*) FROM public.answers
        WHERE attempt_id = p_attempt_id AND selected_answer IS NOT NULL
      )
    );
  END IF;

  IF v_attempt.status <> 'in_progress' THEN
    RAISE EXCEPTION 'المحاولة ليست قيد التنفيذ';
  END IF;

  SELECT end_at INTO v_exam_end_at
  FROM public.exams
  WHERE id = v_attempt.exam_id;

  IF EXISTS (
    SELECT 1 FROM public.questions
    WHERE exam_id = v_attempt.exam_id AND points <= 0
  ) THEN
    RAISE EXCEPTION 'توجد أسئلة بدرجات غير صالحة. يرجى التواصل مع الإدارة';
  END IF;

  UPDATE public.answers AS a
  SET is_correct = (
    a.selected_answer IS NOT NULL
    AND a.selected_answer = q.correct_answer
  )
  FROM public.questions AS q
  WHERE a.question_id = q.id
    AND a.attempt_id = p_attempt_id;

  SELECT
    COALESCE(SUM(CASE WHEN a.is_correct THEN q.points ELSE 0 END), 0),
    COALESCE(SUM(q.points), 0),
    count(a.id) FILTER (WHERE a.selected_answer IS NOT NULL)
  INTO v_score, v_max_score, v_graded_count
  FROM public.questions AS q
  LEFT JOIN public.answers AS a
    ON a.question_id = q.id
   AND a.attempt_id = p_attempt_id
  WHERE q.exam_id = v_attempt.exam_id;

  v_final_status := CASE
    WHEN p_auto_submitted
      OR (v_attempt.expires_at IS NOT NULL AND v_attempt.expires_at <= now())
      OR (v_exam_end_at IS NOT NULL AND v_exam_end_at <= now())
    THEN 'auto_submitted'
    ELSE 'submitted'
  END;

  UPDATE public.exam_attempts
  SET score = v_score,
      max_score = v_max_score,
      submitted_at = now(),
      status = v_final_status
  WHERE id = p_attempt_id
  RETURNING * INTO v_attempt;

  RETURN json_build_object(
    'score', v_score,
    'max_score', v_max_score,
    'percentage', CASE WHEN v_max_score > 0
      THEN round((v_score / v_max_score) * 100, 2)
      ELSE 0
    END,
    'graded_count', v_graded_count
  );
END;
$$;

CREATE INDEX IF NOT EXISTS idx_attempts_expiry_in_progress
  ON public.exam_attempts(expires_at)
  WHERE status = 'in_progress';

CREATE OR REPLACE FUNCTION public.finalize_expired_attempts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attempt_id uuid;
  v_finalized integer := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'غير مصرّح';
  END IF;

  FOR v_attempt_id IN
    SELECT a.id
    FROM public.exam_attempts AS a
    LEFT JOIN public.exams AS e ON e.id = a.exam_id
    WHERE a.status = 'in_progress'
      AND (
        (a.expires_at IS NOT NULL AND a.expires_at <= now())
        OR (e.end_at IS NOT NULL AND e.end_at <= now())
      )
    FOR UPDATE OF a
  LOOP
    PERFORM public.grade_attempt(v_attempt_id, true);
    v_finalized := v_finalized + 1;
  END LOOP;

  RETURN v_finalized;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_student_recording(
  p_attempt_id uuid,
  p_type text
)
RETURNS public.recordings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recording public.recordings%ROWTYPE;
BEGIN
  IF p_type IS NULL OR p_type NOT IN ('camera', 'audio') THEN
    RAISE EXCEPTION 'نوع التسجيل غير صالح';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.exam_attempts AS a
    JOIN public.students AS s ON s.id = a.student_id
    WHERE a.id = p_attempt_id
      AND a.status = 'in_progress'
      AND (a.expires_at IS NULL OR a.expires_at > now())
      AND EXISTS (
        SELECT 1 FROM public.exams AS e
        WHERE e.id = a.exam_id
          AND (e.end_at IS NULL OR e.end_at > now())
      )
      AND s.auth_user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'المحاولة غير متاحة للتسجيل';
  END IF;

  SELECT * INTO v_recording
  FROM public.recordings
  WHERE attempt_id = p_attempt_id AND type = p_type
  ORDER BY created_at
  LIMIT 1;

  IF FOUND THEN
    IF v_recording.status NOT IN ('recording', 'failed') THEN
      RAISE EXCEPTION 'التسجيل موجود مسبقاً';
    END IF;

    UPDATE public.recordings
    SET status = 'recording'
    WHERE id = v_recording.id
    RETURNING * INTO v_recording;
    RETURN v_recording;
  END IF;

  INSERT INTO public.recordings (attempt_id, type, status)
  VALUES (p_attempt_id, p_type, 'recording')
  RETURNING * INTO v_recording;
  RETURN v_recording;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_upload_student_recording(p_name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exam_id text := split_part(p_name, '/', 1);
  v_attempt_id text := split_part(p_name, '/', 2);
  v_recording_id text := split_part(p_name, '/', 3);
  v_filename text := split_part(p_name, '/', 4);
BEGIN
  IF array_length(string_to_array(p_name, '/'), 1) <> 4
     OR v_exam_id !~* '^[0-9a-f-]{36}$'
     OR v_attempt_id !~* '^[0-9a-f-]{36}$'
     OR v_recording_id !~* '^[0-9a-f-]{36}$' THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.exam_attempts AS a
    JOIN public.students AS s ON s.id = a.student_id
    JOIN public.recordings AS r ON r.attempt_id = a.id
    WHERE a.id = v_attempt_id::uuid
      AND a.exam_id = v_exam_id::uuid
      AND r.id = v_recording_id::uuid
      AND r.status IN ('recording', 'failed')
      AND s.auth_user_id = auth.uid()
      AND (
        (r.type = 'camera' AND v_filename = 'video.webm')
        OR (r.type = 'audio' AND v_filename = 'audio.webm')
      )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.update_student_recording(
  p_recording_id uuid,
  p_status text,
  p_storage_path text DEFAULT NULL,
  p_duration_seconds integer DEFAULT NULL,
  p_file_size_bytes bigint DEFAULT NULL,
  p_is_video boolean DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recording public.recordings%ROWTYPE;
  v_attempt public.exam_attempts%ROWTYPE;
  v_expected_path text;
BEGIN
  SELECT r.* INTO v_recording
  FROM public.recordings AS r
  JOIN public.exam_attempts AS a ON a.id = r.attempt_id
  JOIN public.students AS s ON s.id = a.student_id
  WHERE r.id = p_recording_id
    AND s.auth_user_id = auth.uid()
  FOR UPDATE OF r, a;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'التسجيل غير موجود';
  END IF;

  SELECT a.* INTO v_attempt
  FROM public.exam_attempts AS a
  WHERE a.id = v_recording.attempt_id;

  IF p_status = 'failed' THEN
    UPDATE public.recordings SET status = 'failed'
    WHERE id = p_recording_id AND status IN ('recording', 'failed');
    RETURN;
  END IF;

  IF p_status IS NULL
     OR p_status <> 'uploaded'
     OR p_storage_path IS NULL
     OR p_duration_seconds IS NULL
     OR p_duration_seconds < 0
     OR p_file_size_bytes IS NULL
     OR p_file_size_bytes <= 0
     OR p_is_video IS NULL THEN
    RAISE EXCEPTION 'بيانات التسجيل غير صالحة';
  END IF;

  v_expected_path := v_attempt.exam_id::text || '/' ||
    v_attempt.id::text || '/' || p_recording_id::text || '/' ||
    CASE WHEN p_is_video THEN 'video.webm' ELSE 'audio.webm' END;

  IF p_storage_path <> v_expected_path
     OR (p_is_video AND v_recording.type <> 'camera')
     OR (NOT p_is_video AND v_recording.type <> 'audio') THEN
    RAISE EXCEPTION 'مسار التسجيل غير صالح';
  END IF;

  UPDATE public.recordings
  SET status = 'uploaded',
      storage_path = p_storage_path,
      video_path = CASE WHEN p_is_video THEN p_storage_path ELSE video_path END,
      audio_path = CASE WHEN NOT p_is_video THEN p_storage_path ELSE audio_path END,
      duration_seconds = p_duration_seconds,
      file_size_bytes = p_file_size_bytes
  WHERE id = p_recording_id
    AND status IN ('recording', 'failed');
END;
$$;

UPDATE storage.buckets
SET public = false
WHERE id = 'recordings';

DROP POLICY IF EXISTS "anon_upload_recordings" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_read_recordings" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_delete_recordings" ON storage.objects;
DROP POLICY IF EXISTS "students_upload_own_recordings" ON storage.objects;
DROP POLICY IF EXISTS "students_update_own_recordings" ON storage.objects;
DROP POLICY IF EXISTS "students_select_own_recordings" ON storage.objects;
DROP POLICY IF EXISTS "admins_read_recordings" ON storage.objects;
DROP POLICY IF EXISTS "admins_delete_recordings" ON storage.objects;
CREATE POLICY "students_upload_own_recordings"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'recordings'
    AND public.can_upload_student_recording(name)
  );
CREATE POLICY "students_update_own_recordings"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'recordings'
    AND public.can_upload_student_recording(name)
  )
  WITH CHECK (
    bucket_id = 'recordings'
    AND public.can_upload_student_recording(name)
  );
CREATE POLICY "students_select_own_recordings"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'recordings'
    AND public.can_upload_student_recording(name)
  );
CREATE POLICY "admins_read_recordings"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'recordings' AND public.is_admin());
CREATE POLICY "admins_delete_recordings"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'recordings' AND public.is_admin());

REVOKE ALL ON FUNCTION public.normalize_student_phone(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.register_student(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_student_attempt_owner(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_student_exam_questions(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.start_exam_attempt(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.save_student_answer(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.grade_attempt(uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.finalize_expired_attempts() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_student_recording(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_upload_student_recording(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_student_recording(uuid, text, text, integer, bigint, boolean) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.normalize_student_phone(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_student(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_student_attempt_owner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_student_exam_questions(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_exam_attempt(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_student_answer(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.grade_attempt(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_expired_attempts() TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_student_recording(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_upload_student_recording(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_student_recording(uuid, text, text, integer, bigint, boolean) TO authenticated;
