# SaifQuiz — منصة الاختبارات الإلكترونية

SaifQuiz is a React and Supabase examination platform. Students use an anonymous Supabase session and enter their name and phone number without phone verification; exam attempts, deadlines, answer saving, grading, and recording authorization are enforced by PostgreSQL.

## Local setup

1. Install dependencies with `npm ci`.
2. Create `project/.env` with the public Supabase project URL and anon key:

   ```env
   VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_KEY
   ```

   Never put a Supabase service-role key in a `VITE_` variable or in frontend code.
3. Apply every SQL file in `supabase/migrations/` in filename order, including the student-auth, exam-security, and anonymous-student-entry migrations.
4. In Supabase Auth settings, enable anonymous sign-ins. Student entry creates a Supabase anonymous session and saves the name and unverified phone number; no SMS provider is required.
5. Create each admin's Supabase Auth account through a trusted administrative process, then insert its matching user ID into `public.admins`. Keep admin provisioning out of the public client.
6. Run `npm run dev`.

The migrations create a private `recordings` bucket and its policies. Student uploads are restricted to their own registered attempt; reading and signing recording URLs requires an active admin session. Video is recorded at a low bitrate and large files use resumable 6 MB TUS chunks. Set the Supabase project and bucket file-size limits high enough for the longest exam recording you expect; interrupted uploads retry while the student keeps the result page open.

Because student phone numbers are not verified, they are contact information only and cannot prove identity. A single attempt is enforced per student session; students may bypass that limit by creating a new anonymous session, for example in another browser or after clearing site data.

## Validation

Run `npm run typecheck`, `npm run lint`, and `npm run build`. A live end-to-end exam test also requires a configured Supabase project, anonymous sign-ins enabled, camera/microphone permissions, and at least one active exam with questions.
