export interface Admin {
  id: string;
  email: string;
  phone: string | null;
  full_name: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Student {
  id: string;
  full_name: string;
  phone: string;
  created_at: string;
  updated_at: string;
}

export type ExamStatus = 'draft' | 'active' | 'inactive' | 'finished';

export interface Exam {
  id: string;
  title: string;
  description: string | null;
  duration_minutes: number | null;
  status: ExamStatus;
  start_at: string | null;
  end_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type CorrectAnswer = 'A' | 'B' | 'C' | 'D';

export interface Question {
  id: string;
  exam_id: string;
  type: string;
  question_text: string;
  content: string;
  choice_a: string;
  choice_b: string;
  choice_c: string;
  choice_d: string;
  correct_answer: CorrectAnswer;
  points: number;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export type StudentQuestion = Omit<Question, 'correct_answer'>;

export interface QuestionInput {
  question_text: string;
  choice_a: string;
  choice_b: string;
  choice_c: string;
  choice_d: string;
  correct_answer: CorrectAnswer;
  points: number;
  order_index: number;
}

export interface ExamInput {
  title: string;
  description: string | null;
  duration_minutes: number | null;
  status: ExamStatus;
  start_at: string | null;
  end_at: string | null;
}

export type AttemptStatus = 'not_started' | 'in_progress' | 'submitted' | 'auto_submitted' | 'graded';

export interface ExamAttempt {
  id: string;
  exam_id: string;
  student_id: string;
  status: AttemptStatus;
  started_at: string | null;
  expires_at: string | null;
  submitted_at: string | null;
  score: number | null;
  max_score: number | null;
  created_at: string;
  updated_at: string;
}

export interface Answer {
  id: string;
  attempt_id: string;
  question_id: string;
  answer_text: string | null;
  selected_answer: CorrectAnswer | null;
  is_correct: boolean | null;
  created_at: string;
  updated_at: string;
}

export type RecordingType = 'camera' | 'screen' | 'audio';
export type RecordingStatus = 'recording' | 'uploading' | 'uploaded' | 'failed';

export interface Recording {
  id: string;
  attempt_id: string;
  type: RecordingType;
  status: RecordingStatus;
  storage_path: string | null;
  video_path: string | null;
  audio_path: string | null;
  duration_seconds: number | null;
  file_size_bytes: number | null;
  created_at: string;
  updated_at: string;
}
