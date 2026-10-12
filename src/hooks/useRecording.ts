import { useState, useRef, useCallback, useEffect } from 'react';
import {
  createRecordingRow,
  updateRecordingUploaded,
  markRecordingFailed,
  uploadRecordingFile,
} from '@/services/recordingService';

export type PermissionState = 'pending' | 'granted' | 'denied' | 'unsupported';

interface UseRecordingOptions {
  examId: string;
  attemptId: string | null;
  enabled: boolean;
}

interface RecordingState {
  isRecording: boolean;
  isUploading: boolean;
  uploadStatus: string | null;
  recordingError: string | null;
}

export function useRecording({ examId, attemptId, enabled }: UseRecordingOptions) {
  const [cameraPermission, setCameraPermission] = useState<PermissionState>('pending');
  const [micPermission, setMicPermission] = useState<PermissionState>('pending');
  const [state, setState] = useState<RecordingState>({
    isRecording: false,
    isUploading: false,
    uploadStatus: null,
    recordingError: null,
  });

  const videoStreamRef = useRef<MediaStream | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const videoRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRecorderRef = useRef<MediaRecorder | null>(null);
  const videoChunksRef = useRef<Blob[]>([]);
  const audioChunksRef = useRef<Blob[]>([]);
  const videoRecordingIdRef = useRef<string | null>(null);
  const audioRecordingIdRef = useRef<string | null>(null);
  const recordStartTimeRef = useRef<number>(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const saveUploadStatus = useCallback((status: string) => {
    if (attemptId) {
      sessionStorage.setItem(`saifquiz_recording_upload_${attemptId}`, status);
    }
  }, [attemptId]);

  const requestPermissions = useCallback(async (): Promise<boolean> => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraPermission('unsupported');
      setMicPermission('unsupported');
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 320, max: 480 },
          height: { ideal: 240, max: 360 },
          frameRate: { ideal: 12, max: 15 },
        },
        audio: true,
      });

      // Check what we actually got
      const hasVideo = stream.getVideoTracks().length > 0;
      const hasAudio = stream.getAudioTracks().length > 0;

      setCameraPermission(hasVideo ? 'granted' : 'denied');
      setMicPermission(hasAudio ? 'granted' : 'denied');

      // Store this combined stream — we'll split it for separate recording
      videoStreamRef.current = new MediaStream(stream.getVideoTracks());
      audioStreamRef.current = new MediaStream(stream.getAudioTracks());

      // Attach to video element for preview
      if (videoRef.current && hasVideo) {
        videoRef.current.srcObject = videoStreamRef.current;
        videoRef.current.play().catch(() => {});
      }

      return hasVideo && hasAudio;
    } catch (err) {
      if (err instanceof DOMException) {
        if (err.name === 'NotAllowedError' || err.name === 'SecurityError') {
          setCameraPermission('denied');
          setMicPermission('denied');
        }
      }
      return false;
    }
  }, []);

  const startRecording = useCallback(async () => {
    if (!enabled || !attemptId) return;
    if (!videoStreamRef.current || !audioStreamRef.current) return;

    try {
      // Create recording metadata rows
      const videoRec = await createRecordingRow(attemptId, 'camera');
      const audioRec = await createRecordingRow(attemptId, 'audio');
      videoRecordingIdRef.current = videoRec.id;
      audioRecordingIdRef.current = audioRec.id;

      videoChunksRef.current = [];
      audioChunksRef.current = [];
      recordStartTimeRef.current = Date.now();

      // Video recorder
      const videoRecorder = new MediaRecorder(videoStreamRef.current, {
        mimeType: getSupportedMimeType(),
        videoBitsPerSecond: 200_000,
      });
      videoRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) videoChunksRef.current.push(e.data);
      };
      videoRecorder.start(1000);
      videoRecorderRef.current = videoRecorder;

      // Audio recorder
      const audioRecorder = new MediaRecorder(audioStreamRef.current, {
        mimeType: getSupportedAudioMimeType(),
        audioBitsPerSecond: 32_000,
      });
      audioRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      audioRecorder.start(1000);
      audioRecorderRef.current = audioRecorder;

      saveUploadStatus('recording');
      setState({ isRecording: true, isUploading: false, uploadStatus: null, recordingError: null });
    } catch (err) {
      saveUploadStatus('failed');
      setState((prev) => ({
        ...prev,
        recordingError: err instanceof Error ? err.message : 'فشل بدء التسجيل',
      }));
    }
  }, [enabled, attemptId, saveUploadStatus]);

  const stopAndUpload = useCallback(async (): Promise<boolean> => {
    if (!attemptId) return true;

    saveUploadStatus('uploading');
    setState((prev) => ({ ...prev, isUploading: true, uploadStatus: 'جاري إيقاف التسجيل...' }));

    const duration = (Date.now() - recordStartTimeRef.current) / 1000;

    // Stop recorders
    const stopPromises: Promise<void>[] = [];

    if (videoRecorderRef.current && videoRecorderRef.current.state !== 'inactive') {
      stopPromises.push(
        new Promise<void>((resolve) => {
          videoRecorderRef.current!.onstop = () => resolve();
          videoRecorderRef.current!.stop();
        }),
      );
    }

    if (audioRecorderRef.current && audioRecorderRef.current.state !== 'inactive') {
      stopPromises.push(
        new Promise<void>((resolve) => {
          audioRecorderRef.current!.onstop = () => resolve();
          audioRecorderRef.current!.stop();
        }),
      );
    }

    await Promise.all(stopPromises);

    setState((prev) => ({ ...prev, isRecording: false, uploadStatus: 'جاري رفع التسجيل...' }));

    // Upload video
    const uploadPromises: Promise<void>[] = [];

    if (videoChunksRef.current.length > 0 && videoRecordingIdRef.current) {
      const videoBlob = new Blob(videoChunksRef.current, {
        type: videoRecorderRef.current?.mimeType || 'video/webm',
      });
      const recId = videoRecordingIdRef.current;
      uploadPromises.push(
        uploadRecordingFile(
          examId,
          attemptId,
          recId,
          'video.webm',
          videoBlob,
          (percentage) => {
            saveUploadStatus(`uploading:${percentage}`);
            setState((prev) => ({
              ...prev,
              uploadStatus: `جاري رفع الفيديو ${percentage}%`,
            }));
          },
        )
          .then((path) => updateRecordingUploaded(recId, path, duration, videoBlob.size, true))
          .catch(async (error: unknown) => {
            await markRecordingFailed(recId);
            throw error;
          }),
      );
    }

    if (audioChunksRef.current.length > 0 && audioRecordingIdRef.current) {
      const audioBlob = new Blob(audioChunksRef.current, {
        type: audioRecorderRef.current?.mimeType || 'audio/webm',
      });
      const recId = audioRecordingIdRef.current;
      uploadPromises.push(
        uploadRecordingFile(
          examId,
          attemptId,
          recId,
          'audio.webm',
          audioBlob,
          (percentage) => {
            setState((prev) => ({
              ...prev,
              uploadStatus: `جاري رفع الصوت ${percentage}%`,
            }));
          },
        )
          .then((path) => updateRecordingUploaded(recId, path, duration, audioBlob.size, false))
          .catch(async (error: unknown) => {
            await markRecordingFailed(recId);
            throw error;
          }),
      );
    }

    const uploadResults = await Promise.allSettled(uploadPromises);
    const failedUpload = uploadResults.find((result) => result.status === 'rejected');
    const uploadFailed = uploadPromises.length === 0 || Boolean(failedUpload);
    saveUploadStatus(uploadFailed ? 'failed' : 'uploaded');

    // Stop all tracks
    videoStreamRef.current?.getTracks().forEach((t) => t.stop());
    audioStreamRef.current?.getTracks().forEach((t) => t.stop());
    videoStreamRef.current = null;
    audioStreamRef.current = null;

    setState({
      isRecording: false,
      isUploading: false,
      uploadStatus: null,
      recordingError: uploadFailed
        ? failedUpload
          ? failedUpload.reason instanceof Error
          ? failedUpload.reason.message
          : 'تعذّر رفع التسجيل'
          : 'لم يتم إنشاء ملف التسجيل'
        : null,
    });
    return !uploadFailed;
  }, [examId, attemptId, saveUploadStatus]);

  const cleanup = useCallback(() => {
    if (videoRecorderRef.current && videoRecorderRef.current.state !== 'inactive') {
      try { videoRecorderRef.current.stop(); } catch { /* */ }
    }
    if (audioRecorderRef.current && audioRecorderRef.current.state !== 'inactive') {
      try { audioRecorderRef.current.stop(); } catch { /* */ }
    }
    videoStreamRef.current?.getTracks().forEach((t) => t.stop());
    audioStreamRef.current?.getTracks().forEach((t) => t.stop());
    videoStreamRef.current = null;
    audioStreamRef.current = null;
  }, []);

  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  return {
    cameraPermission,
    micPermission,
    requestPermissions,
    startRecording,
    stopAndUpload,
    cleanup,
    videoRef,
    ...state,
  };
}

function getSupportedMimeType(): string {
  const types = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
    'video/mp4',
  ];
  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return 'video/webm';
}

function getSupportedAudioMimeType(): string {
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return 'audio/webm';
}
