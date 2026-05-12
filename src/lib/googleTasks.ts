import { supabase } from './supabase';
import { USER_ID } from './env';
import { getValidAccessToken } from './googleAuth';
import { Business, Task } from './types';

const API = 'https://tasks.googleapis.com/tasks/v1';

export interface GTaskList {
  id: string;
  title: string;
}

export interface GTask {
  id: string;
  title: string;
  notes?: string;
  status: 'needsAction' | 'completed';
  due?: string;
  updated: string;
}

async function gfetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getValidAccessToken();
  if (!token) throw new Error('Not signed in to Google');
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google Tasks ${res.status}: ${body}`);
  }
  return (await res.json()) as T;
}

export async function listTaskLists(): Promise<GTaskList[]> {
  const json = await gfetch<{ items?: GTaskList[] }>('/users/@me/lists');
  return json.items ?? [];
}

export async function listTasks(listId: string): Promise<GTask[]> {
  const json = await gfetch<{ items?: GTask[] }>(
    `/lists/${encodeURIComponent(listId)}/tasks?showCompleted=true&showHidden=true`,
  );
  return json.items ?? [];
}

export async function createGTask(
  listId: string,
  task: { title: string; notes?: string; due?: string },
): Promise<GTask> {
  return gfetch<GTask>(`/lists/${encodeURIComponent(listId)}/tasks`, {
    method: 'POST',
    body: JSON.stringify(task),
  });
}

export async function updateGTask(
  listId: string,
  taskId: string,
  patch: Partial<GTask>,
): Promise<GTask> {
  return gfetch<GTask>(
    `/lists/${encodeURIComponent(listId)}/tasks/${encodeURIComponent(taskId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(patch),
    },
  );
}

export async function completeGTask(listId: string, taskId: string): Promise<void> {
  await updateGTask(listId, taskId, { status: 'completed' });
}

// ─── Sync helpers tying Google Tasks <-> Supabase tasks ───────────────────────

const BUSINESS_TAG = '[hermes:';

export function tagFor(b: Business): string {
  return `${BUSINESS_TAG}${b}]`;
}

function businessFromTitle(title: string): Business | null {
  const m = title.match(/\[hermes:(geo_logistics|nestlink|crownstone|personal)\]/);
  return (m?.[1] as Business | undefined) ?? null;
}

function stripTag(title: string): string {
  return title.replace(/\s*\[hermes:[^\]]+\]\s*$/, '').trim();
}

// Push a Supabase task to Google Tasks (one-way: app -> Google).
export async function pushTaskToGoogle(task: Task, listId: string): Promise<void> {
  const title = `${task.description} ${tagFor(task.business)}`;
  const due = task.deadline ? `${task.deadline}T00:00:00.000Z` : undefined;
  const notes = task.notes ?? undefined;

  if (task.google_task_id && task.google_tasklist_id === listId) {
    await updateGTask(listId, task.google_task_id, {
      title,
      notes,
      due,
      status: task.status === 'done' ? 'completed' : 'needsAction',
    });
    await supabase
      .from('tasks')
      .update({ google_synced_at: new Date().toISOString() })
      .eq('id', task.id);
    return;
  }

  const created = await createGTask(listId, { title, notes, due });
  await supabase
    .from('tasks')
    .update({
      google_task_id: created.id,
      google_tasklist_id: listId,
      google_synced_at: new Date().toISOString(),
    })
    .eq('id', task.id);
}

// Pull Google completions back into Supabase. We don't import every Google
// task — only ones we previously pushed (matched by google_task_id).
export async function pullGoogleCompletions(listId: string): Promise<number> {
  const remote = await listTasks(listId);
  const ids = remote.map((t) => t.id);
  if (!ids.length) return 0;
  const { data: ours, error } = await supabase
    .from('tasks')
    .select('id, status, google_task_id')
    .eq('user_id', USER_ID)
    .in('google_task_id', ids);
  if (error) throw error;
  const byGid = new Map(remote.map((t) => [t.id, t]));
  let updated = 0;
  for (const row of ours ?? []) {
    const g = byGid.get(row.google_task_id as string);
    if (!g) continue;
    if (g.status === 'completed' && row.status !== 'done') {
      await supabase
        .from('tasks')
        .update({
          status: 'done',
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id);
      updated++;
    }
  }
  return updated;
}

// Read & cache the user's chosen default Google task list id.
export async function getDefaultListId(): Promise<string | null> {
  const { data } = await supabase
    .from('user_preferences')
    .select('google_default_tasklist_id')
    .eq('user_id', USER_ID)
    .maybeSingle();
  return (data?.google_default_tasklist_id as string | null) ?? null;
}

export async function setDefaultListId(id: string): Promise<void> {
  await supabase
    .from('user_preferences')
    .update({ google_default_tasklist_id: id, google_tasks_sync_enabled: true })
    .eq('user_id', USER_ID);
}

export { businessFromTitle, stripTag };
