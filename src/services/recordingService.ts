import { supabase } from '@/lib/supabase';
import * as tus from 'tus-js-client';
import type { Recording } from '@/types';

export async function createRecordingRow(
  attemptId: string,
  type: 'camera' | 'audio',
): Promise<Recording> {
  const { data, error } = await supabase.rpc('create_student_recording', {
    p_attempt_id: attemptId,
    p_type: type,
  });

  if (error) throw new Error(error.message);
  return data as Recording;
}

export async function updateRecordingUploaded(
  recordingId: string,
  storagePath: string,
  durationSeconds: number,
  fileSizeBytes: number,
  isVideo: boolean,
): Promise<void> {
  const { error } = await supabase.rpc('update_student_recording', {
    p_recording_id: recordingId,
    p_status: 'uploaded',
    p_storage_path: storagePath,
    p_duration_seconds: Math.round(durationSeconds),
    p_file_size_bytes: fileSizeBytes,
    p_is_video: isVideo,
  });
  if (error) throw new Error(error.message);
}

export async function markRecordingFailed(recordingId: string): Promise<void> {
  const { error } = await supabase.rpc('update_student_recording', {
    p_recording_id: recordingId,
    p_status: 'failed',
  });
  if (error) throw new Error(error.message);
}

export async function uploadRecordingFile(
  examId: string,
  attemptId: string,
  recordingId: string,
  fileName: string,
  blob: Blob,
  onProgress?: (percentage: number) => void,
): Promise<string> {
  const filePath = `${examId}/${attemptId}/${recordingId}/${fileName}`;
  const bucket = supabase.storage.from('recordings');

  if (blob.size <= 6 * 1024 * 1024) {
    const { error } = await bucket.upload(filePath, blob, {
      contentType: blob.type || 'video/webm',
      upsert: true,
    });

    if (error) throw new Error(error.message);
    onProgress?.(100);
    return filePath;
  }

  const { data, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw new Error(sessionError.message);
  if (!data.session) throw new Error('انتهت جلسة الطالب. سجّل الدخول مجدداً لرفع التسجيل');

  const projectUrl = new URL(import.meta.env.VITE_SUPABASE_URL);
  const storageOrigin = projectUrl.hostname.endsWith('.supabase.co')
    ? `https://${projectUrl.hostname.replace(/\.supabase\.co$/, '.storage.supabase.co')}`
    : projectUrl.origin;

  return new Promise<string>((resolve, reject) => {
    const upload = new tus.Upload(blob, {
      endpoint: `${storageOrigin}/storage/v1/upload/resumable`,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: {
        authorization: `Bearer ${data.session.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        'x-upsert': 'true',
      },
      onBeforeRequest: async (request) => {
        const { data: sessionData, error: authError } = await supabase.auth.getSession();
        if (authError) throw new Error(authError.message);
        let session = sessionData.session;
        if (!session) throw new Error('انتهت جلسة الطالب. سجّل الدخول مجدداً لرفع التسجيل');

        if (session.expires_at && session.expires_at * 1000 <= Date.now() + 60_000) {
          const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
          if (refreshError) throw new Error(refreshError.message);
          if (!refreshed.session) throw new Error('تعذّر تجديد جلسة رفع التسجيل');
          session = refreshed.session;
        }

        request.setHeader('authorization', `Bearer ${session.access_token}`);
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      chunkSize: 6 * 1024 * 1024,
      metadata: {
        bucketName: 'recordings',
        objectName: filePath,
        contentType: blob.type || 'video/webm',
        cacheControl: '3600',
      },
      onError: (uploadError) => reject(new Error(uploadError.message)),
      onProgress: (bytesUploaded, bytesTotal) => {
        onProgress?.(Math.floor((bytesUploaded / bytesTotal) * 100));
      },
      onSuccess: () => resolve(filePath),
    });

    void upload.findPreviousUploads().then((previousUploads) => {
      if (previousUploads.length > 0) upload.resumeFromPreviousUpload(previousUploads[0]);
      upload.start();
    }).catch(reject);
  });
}

export async function fetchRecordingsByAttempt(attemptId: string): Promise<Recording[]> {
  const { data, error } = await supabase
    .from('recordings')
    .select('*')
    .eq('attempt_id', attemptId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as Recording[];
}

export async function createSignedUrl(path: string, expiresIn: number = 3600): Promise<string> {
  const { data, error } = await supabase.storage
    .from('recordings')
    .createSignedUrl(path, expiresIn);

  if (error) throw new Error(error.message);
  return data.signedUrl;
}
