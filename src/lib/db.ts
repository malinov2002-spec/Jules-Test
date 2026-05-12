import { supabase } from './supabase';
import { USER_ID } from './env';
import {
  Business,
  CheckIn,
  CheckInType,
  MIT,
  Task,
  TimeBucket,
  isoDate,
  timeBucket,
} from './types';

// ─── Tasks ────────────────────────────────────────────────────────────────────

export interface CreateTaskInput {
  description: string;
  business: Business;
  type?: 'task' | 'idea' | 'decision' | 'waiting_for';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  deadline?: string | null;
  estimated_minutes?: number | null;
  notes?: string | null;
  source?: string;
}

export async function createTask(input: CreateTaskInput): Promise<Task> {
  const { data, error } = await supabase
    .from('tasks')
    .insert({
      user_id: USER_ID,
      description: input.description,
      business: input.business,
      type: input.type ?? 'task',
      priority: input.priority ?? null,
      deadline: input.deadline ?? null,
      estimated_minutes: input.estimated_minutes ?? null,
      notes: input.notes ?? null,
      source: input.source ?? 'mobile_capture',
      created_time_bucket: timeBucket(),
      status: 'open',
    })
    .select()
    .single();
  if (error) throw error;
  return data as Task;
}

export async function listOpenTasks(business?: Business): Promise<Task[]> {
  let q = supabase
    .from('tasks')
    .select('*')
    .eq('user_id', USER_ID)
    .in('status', ['open', 'captured_for_review', 'in_progress'])
    .order('deadline', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });
  if (business) q = q.eq('business', business);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Task[];
}

export async function listTasksCreatedOn(date: string): Promise<Task[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', USER_ID)
    .gte('created_at', `${date}T00:00:00`)
    .lt('created_at', `${date}T23:59:59`)
    .order('created_at');
  if (error) throw error;
  return (data ?? []) as Task[];
}

export async function updateTaskStatus(
  id: string,
  status: Task['status'],
  extras?: Partial<Task>,
): Promise<void> {
  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (status === 'done') patch.completed_at = new Date().toISOString();
  if (status === 'dropped') patch.dropped_at = new Date().toISOString();
  if (status === 'pushed') {
    const { data } = await supabase.from('tasks').select('push_count').eq('id', id).single();
    patch.push_count = ((data?.push_count as number | undefined) ?? 0) + 1;
  }
  const { error } = await supabase.from('tasks').update({ ...patch, ...extras }).eq('id', id);
  if (error) throw error;
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await supabase.from('tasks').delete().eq('id', id);
  if (error) throw error;
}

// ─── MITs ─────────────────────────────────────────────────────────────────────

export async function listMITs(date = isoDate()): Promise<(MIT & { task: Task | null })[]> {
  const { data, error } = await supabase
    .from('mits')
    .select('*, task:tasks(*)')
    .eq('user_id', USER_ID)
    .eq('date', date);
  if (error) throw error;
  return (data ?? []) as (MIT & { task: Task | null })[];
}

export async function setMIT(
  business: Business,
  task_id: string,
  target_time_block?: string,
): Promise<void> {
  const { error } = await supabase.from('mits').upsert(
    {
      user_id: USER_ID,
      date: isoDate(),
      business,
      task_id,
      target_time_block: target_time_block ?? null,
    },
    { onConflict: 'user_id,date,business' },
  );
  if (error) throw error;
}

export async function markMITComplete(id: string, completed: boolean): Promise<void> {
  const { error } = await supabase
    .from('mits')
    .update({
      completed,
      completed_at: completed ? new Date().toISOString() : null,
    })
    .eq('id', id);
  if (error) throw error;
}

// ─── Check-ins ────────────────────────────────────────────────────────────────

export async function startCheckIn(type: CheckInType): Promise<CheckIn> {
  const today = isoDate();
  const { data: existing } = await supabase
    .from('check_ins')
    .select('*')
    .eq('user_id', USER_ID)
    .eq('date', today)
    .eq('type', type)
    .maybeSingle();
  if (existing) return existing as CheckIn;
  const { data, error } = await supabase
    .from('check_ins')
    .insert({ user_id: USER_ID, type, date: today })
    .select()
    .single();
  if (error) throw error;
  return data as CheckIn;
}

export async function updateCheckIn(id: string, patch: Partial<CheckIn>): Promise<void> {
  const { error } = await supabase.from('check_ins').update(patch).eq('id', id);
  if (error) throw error;
}

export async function completeCheckIn(id: string, started: string): Promise<void> {
  const ended = new Date();
  const duration = Math.round((ended.getTime() - new Date(started).getTime()) / 1000);
  const { error } = await supabase
    .from('check_ins')
    .update({
      completed: true,
      time_ended: ended.toISOString(),
      duration_seconds: duration,
    })
    .eq('id', id);
  if (error) throw error;
}

export async function todayCheckIn(type: CheckInType): Promise<CheckIn | null> {
  const { data } = await supabase
    .from('check_ins')
    .select('*')
    .eq('user_id', USER_ID)
    .eq('date', isoDate())
    .eq('type', type)
    .maybeSingle();
  return (data as CheckIn | null) ?? null;
}

// ─── Decisions ────────────────────────────────────────────────────────────────

export async function logDecision(input: {
  description: string;
  decision_type?: string;
  business?: Business;
  amount_usd?: number;
  energy_at_decision?: number;
  notes?: string;
}): Promise<void> {
  const { error } = await supabase.from('decisions').insert({
    user_id: USER_ID,
    description: input.description,
    decision_type: input.decision_type ?? 'other',
    business: input.business ?? null,
    amount_usd: input.amount_usd ?? null,
    energy_at_decision: input.energy_at_decision ?? null,
    time_of_day_bucket: timeBucket(),
    notes: input.notes ?? null,
  });
  if (error) throw error;
}

// ─── Coach messages (chat history) ───────────────────────────────────────────

export async function loadThread(thread = 'main', limit = 50) {
  const { data, error } = await supabase
    .from('coach_messages')
    .select('*')
    .eq('user_id', USER_ID)
    .eq('thread', thread)
    .order('created_at', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function appendMessage(
  thread: string,
  role: 'user' | 'assistant' | 'system',
  content: string,
  skill?: string,
): Promise<void> {
  const { error } = await supabase.from('coach_messages').insert({
    user_id: USER_ID,
    thread,
    role,
    content,
    skill: skill ?? null,
  });
  if (error) throw error;
}

// ─── Aggregate stats for "show me how I'm doing" view ────────────────────────

export async function getThisWeekStats(): Promise<{
  kickoffs: number;
  shutdowns: number;
  mitsCompleted: number;
  mitsTotal: number;
  tasksDone: number;
  tasksDropped: number;
  avgMorningEnergy: number | null;
}> {
  const start = new Date();
  start.setDate(start.getDate() - 6);
  const startIso = isoDate(start);

  const [{ data: ci }, { data: ms }, { data: ts }] = await Promise.all([
    supabase
      .from('check_ins')
      .select('type, energy, completed')
      .eq('user_id', USER_ID)
      .gte('date', startIso),
    supabase
      .from('mits')
      .select('completed')
      .eq('user_id', USER_ID)
      .gte('date', startIso),
    supabase
      .from('tasks')
      .select('status')
      .eq('user_id', USER_ID)
      .gte('updated_at', `${startIso}T00:00:00`),
  ]);

  const checkIns = ci ?? [];
  const kickoffs = checkIns.filter(
    (c) => c.type === 'morning_kickoff' && c.completed,
  ).length;
  const shutdowns = checkIns.filter(
    (c) => c.type === 'evening_shutdown' && c.completed,
  ).length;
  const energies = checkIns
    .filter((c) => c.type === 'morning_kickoff' && typeof c.energy === 'number')
    .map((c) => c.energy as number);
  const avgMorningEnergy = energies.length
    ? Math.round((energies.reduce((a, b) => a + b, 0) / energies.length) * 10) / 10
    : null;

  const mits = ms ?? [];
  const mitsCompleted = mits.filter((m) => m.completed).length;
  const mitsTotal = mits.length;

  const tasks = ts ?? [];
  const tasksDone = tasks.filter((t) => t.status === 'done').length;
  const tasksDropped = tasks.filter((t) => t.status === 'dropped').length;

  return {
    kickoffs,
    shutdowns,
    mitsCompleted,
    mitsTotal,
    tasksDone,
    tasksDropped,
    avgMorningEnergy,
  };
}
