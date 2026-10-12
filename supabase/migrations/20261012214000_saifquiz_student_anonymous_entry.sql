CREATE OR REPLACE FUNCTION public.register_student(
  p_full_name text,
  p_phone text
)
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
     OR cardinality(regexp_split_to_array(trim(p_full_name), '[[:space:]]+')) < 3
     OR p_phone IS NULL
     OR p_phone !~ '^[+0-9[:space:]().-]+$' THEN
    RAISE EXCEPTION 'بيانات الطالب غير صالحة';
  END IF;

  IF public.is_admin() THEN
    RAISE EXCEPTION 'استخدم حساب طالب لتسجيل الدخول';
  END IF;

  v_phone := public.normalize_student_phone(p_phone);
  IF v_phone !~ '^\+[1-9][0-9]{7,14}$' THEN
    RAISE EXCEPTION 'رقم الهاتف غير صالح';
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
    IF v_student.auth_user_id IS DISTINCT FROM v_user_id THEN
      RAISE EXCEPTION 'رقم الهاتف مسجل مسبقاً. يرجى التواصل مع الإدارة';
    END IF;

    UPDATE public.students
    SET full_name = trim(p_full_name),
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

REVOKE ALL ON FUNCTION public.register_student(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_student(text, text) TO authenticated;
