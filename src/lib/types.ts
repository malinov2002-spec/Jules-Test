export type Business = 'geo_logistics' | 'nestlink' | 'crownstone' | 'personal';
export type TaskType = 'task' | 'idea' | 'decision' | 'waiting_for';
export type TaskStatus =
  | 'open'
  | 'captured_for_review'
  | 'in_progress'
  | 'done'
  | 'dropped'
  | 'pushed';
export type Priority = 'low' | 'medium' | 'high' | 'urgent';
export type TimeBucket = 'morning' | 'midday' | 'evening' | 'late_night';

export interface Task {
  id: string;
  user_id: string;
  description: string;
  business: Business;
  type: TaskType;
  status: TaskStatus;
  priority: Priority | null;
  deadline: string | null;
  estimated_minutes: number | null;
  actual_minutes: number | null;
  created_time_bucket: TimeBucket | null;
  source: string | null;
  notes: string | null;
  push_count: number;
  original_created_at: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  dropped_at: string | null;
  dropped_reason: string | null;
  google_task_id: string | null;
  google_tasklist_id: string | null;
  google_synced_at: string | null;
}

export interface MIT {
  id: string;
  user_id: string;
  date: string;
  business: Business;
  task_id: string | null;
  target_time_block: string | null;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
}

export type CheckInType =
  | 'morning_kickoff'
  | 'evening_shutdown'
  | 'midday_refocus'
  | 'weekly_review';

export interface CheckIn {
  id: string;
  user_id: string;
  type: CheckInType;
  date: string;
  time_started: string;
  time_ended: string | null;
  completed: boolean;
  duration_seconds: number | null;
  energy: number | null;
  mood_notes: string | null;
  daily_intention: string | null;
  daily_intention_backup: string | null;
  ravikant_completed: boolean;
  daily_win: string | null;
  intention_met: boolean | null;
  intention_met_notes: string | null;
  mits_completed_count: number | null;
  tasks_pushed_count: number | null;
  tasks_dropped_count: number | null;
  notes: string | null;
}

export interface CoachMessage {
  id: string;
  user_id: string;
  thread: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  skill: string | null;
  created_at: string;
}

export const BUSINESSES: { value: Business; label: string; short: string }[] = [
  { value: 'geo_logistics', label: 'Geo Logistics', short: 'Geo' },
  { value: 'nestlink', label: 'NestLink', short: 'Nest' },
  { value: 'crownstone', label: 'Crownstone', short: 'Crown' },
  { value: 'personal', label: 'Personal', short: 'Self' },
];

export const businessColor = (b: Business): string => {
  switch (b) {
    case 'geo_logistics':
      return '#f59e0b';
    case 'nestlink':
      return '#3b82f6';
    case 'crownstone':
      return '#a855f7';
    case 'personal':
      return '#10b981';
  }
};

export const timeBucket = (d: Date = new Date()): TimeBucket => {
  const h = d.getHours();
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 17) return 'midday';
  if (h >= 17 && h < 22) return 'evening';
  return 'late_night';
};

export const isoDate = (d: Date = new Date()): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
