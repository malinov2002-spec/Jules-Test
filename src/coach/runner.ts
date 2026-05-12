import {
  appendMessage,
  createTask,
  logDecision,
  startCheckIn,
  todayCheckIn,
  updateCheckIn,
  completeCheckIn,
} from '../lib/db';
import { isoDate, timeBucket } from '../lib/types';
import { CoachAction, CoachReply, ChatTurn, sendToCoach } from './anthropic';
import { SkillName } from './skills';

export interface RunOptions {
  skill: SkillName;
  thread: string;
  userMessage: string;
  history: ChatTurn[];
  contextBlock?: string;
}

export async function runCoach(opts: RunOptions): Promise<CoachReply> {
  // Persist user turn first so the chat is durable even if the API call fails.
  await appendMessage(opts.thread, 'user', opts.userMessage, opts.skill);

  const reply = await sendToCoach({
    skill: opts.skill,
    history: opts.history,
    userMessage: opts.userMessage,
    contextBlock: opts.contextBlock,
  });

  if (reply.text) {
    await appendMessage(opts.thread, 'assistant', reply.text, opts.skill);
  }

  for (const action of reply.actions) {
    try {
      await executeAction(action, opts.skill);
    } catch (e) {
      // We log the failure as a system message so the user can see something
      // went wrong with that action; don't crash the whole reply.
      await appendMessage(
        opts.thread,
        'system',
        `Action failed: ${(e as Error).message}\n${JSON.stringify(action)}`,
        opts.skill,
      );
    }
  }

  return reply;
}

async function executeAction(action: CoachAction, skill: SkillName): Promise<void> {
  switch (action.type) {
    case 'create_task':
      await createTask({
        description: action.description,
        business: action.business,
        deadline: action.deadline ?? null,
        priority: action.priority ?? undefined,
        estimated_minutes: action.estimated_minutes ?? null,
        source: `coach:${skill}`,
      });
      return;
    case 'log_decision':
      await logDecision({
        description: action.description,
        decision_type: action.decision_type,
        business: (action.business as never) ?? undefined,
        amount_usd: action.amount_usd ?? undefined,
      });
      return;
    case 'set_intention': {
      const ci = await startCheckIn('morning_kickoff');
      await updateCheckIn(ci.id, { daily_intention: action.intention });
      return;
    }
    case 'set_energy': {
      const ci = await startCheckIn('morning_kickoff');
      await updateCheckIn(ci.id, {
        energy: action.energy,
        mood_notes: action.notes ?? null,
      });
      return;
    }
    case 'complete_kickoff': {
      const ci = await todayCheckIn('morning_kickoff');
      if (ci) await completeCheckIn(ci.id, ci.time_started);
      return;
    }
    case 'complete_shutdown': {
      const ci = await todayCheckIn('evening_shutdown');
      if (ci) await completeCheckIn(ci.id, ci.time_started);
      return;
    }
  }
}

export function buildContextBlock(parts: string[]): string {
  return [
    `CURRENT CONTEXT (${new Date().toString()})`,
    `Date: ${isoDate()}  Time bucket: ${timeBucket()}`,
    ...parts,
  ].join('\n');
}
