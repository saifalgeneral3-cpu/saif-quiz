/*
# SaifQuiz Phase 7: Security hardening

## Issues fixed
1. `handle_updated_at` and `handle_recording_updated_at` have mutable search_path
   → Set explicit search_path to public
2. `grade_attempt` is callable by anon — this is intentional since students
   (who are not Supabase-authenticated) need to submit exams. But the function
   already validates the attempt exists and sets grades server-side, so this
   is acceptable. No change needed.
3. `is_admin` is callable by anon — intentional, it only returns boolean
   and is needed for RLS policy evaluation. No change needed.
*/

-- Fix mutable search_path on trigger functions
ALTER FUNCTION public.handle_updated_at() SET search_path = public;
ALTER FUNCTION public.handle_recording_updated_at() SET search_path = public;
