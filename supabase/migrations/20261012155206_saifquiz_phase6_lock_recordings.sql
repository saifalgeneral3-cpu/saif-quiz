/*
# SaifQuiz Phase 6: Lock down recordings SELECT to admin-only

## Why
Currently `recordings_select_all` allows anon (students) to read ALL recording
metadata for any attempt. Students should never be able to query other students'
recording metadata. Only authenticated admins should see recordings.

## Change
- Drop `recordings_select_all` (allowed anon + authenticated with USING true)
- Create `recordings_select_admin` restricted to authenticated admins via is_admin()
*/
DROP POLICY IF EXISTS "recordings_select_all" ON public.recordings;
DROP POLICY IF EXISTS "recordings_select_admin" ON public.recordings;

CREATE POLICY "recordings_select_admin"
  ON public.recordings FOR SELECT
  TO authenticated
  USING (is_admin());
