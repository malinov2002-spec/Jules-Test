import Anthropic from '@anthropic-ai/sdk';
import { env } from '../lib/env';
import { COACH_SYSTEM_PROMPT } from './systemPrompt';
import { SKILL_PRIMERS, SkillName } from './skills';

// Direct-from-device Anthropic client. For a single-user personal app this is
// acceptable; if you ever ship this to others, proxy through a backend.
export const anthropic = new Anthropic({
  apiKey: env.anthropicApiKey,
  // dangerouslyAllowBrowser also covers React Native fetch environment.
  dangerouslyAllowBrowser: true,
});

export const COACH_MODEL = 'claude-sonnet-4-6';
export const COACH_FALLBACK_MODEL = 'claude-haiku-4-5-20251001';

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface CoachContext {
  // Plain string injected as a SECOND system block so it's cacheable separately
  // from the static coach prompt.
  contextBlock?: string;
  skill: SkillName;
  history: ChatTurn[];
  userMessage: string;
}

export interface CoachReply {
  text: string;
  actions: CoachAction[];
}

export type CoachAction =
  | {
      type: 'create_task';
      description: string;
      business: 'geo_logistics' | 'nestlink' | 'crownstone' | 'personal';
      deadline?: string | null;
      priority?: 'low' | 'medium' | 'high' | 'urgent' | null;
      estimated_minutes?: number | null;
    }
  | {
      type: 'log_decision';
      description: string;
      decision_type?: string;
      business?: string | null;
      amount_usd?: number | null;
    }
  | { type: 'set_intention'; intention: string }
  | { type: 'set_energy'; energy: number; notes?: string | null }
  | { type: 'complete_kickoff' }
  | { type: 'complete_shutdown' };

export async function sendToCoach(ctx: CoachContext): Promise<CoachReply> {
  const systemBlocks: Anthropic.Messages.TextBlockParam[] = [
    {
      type: 'text',
      text: COACH_SYSTEM_PROMPT,
      cache_control: { type: 'ephemeral' },
    },
    {
      type: 'text',
      text: SKILL_PRIMERS[ctx.skill],
    },
  ];

  if (ctx.contextBlock) {
    systemBlocks.push({ type: 'text', text: ctx.contextBlock });
  }

  const messages: Anthropic.Messages.MessageParam[] = [
    ...ctx.history.map((t) => ({ role: t.role, content: t.content })),
    { role: 'user', content: ctx.userMessage },
  ];

  let resp: Anthropic.Messages.Message;
  try {
    resp = await anthropic.messages.create({
      model: COACH_MODEL,
      max_tokens: 1024,
      temperature: 0.7,
      system: systemBlocks,
      messages,
    });
  } catch (e) {
    resp = await anthropic.messages.create({
      model: COACH_FALLBACK_MODEL,
      max_tokens: 1024,
      temperature: 0.7,
      system: systemBlocks,
      messages,
    });
  }

  const raw = resp.content
    .filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n');

  return parseReply(raw);
}

export function parseReply(raw: string): CoachReply {
  const actions: CoachAction[] = [];
  const textLines: string[] = [];
  for (const line of raw.split('\n')) {
    const m = line.match(/^\s*ACTION:\s*(\{.*\})\s*$/);
    if (m) {
      try {
        actions.push(JSON.parse(m[1]) as CoachAction);
        continue;
      } catch {
        // fall through and keep as text
      }
    }
    textLines.push(line);
  }
  return { text: textLines.join('\n').trim(), actions };
}
