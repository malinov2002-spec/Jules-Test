import { env } from '../lib/env';
import { ChatTurn, CoachAction, CoachReply } from './anthropic';
import { SkillName } from './skills';

export interface GatewayRequest {
  thread: string;
  skill: SkillName;
  message: string;
  surface?: 'mobile_android' | 'mobile_ios';
}

export interface GatewayResponse {
  text: string;
  actions: CoachAction[];
  skipped: boolean;
}

export async function sendToGateway(req: GatewayRequest): Promise<CoachReply> {
  const res = await fetch(`${env.gatewayUrl.replace(/\/$/, '')}/coach`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.gatewayToken}`,
    },
    body: JSON.stringify({
      thread: req.thread,
      skill: req.skill,
      message: req.message,
      surface: req.surface ?? 'mobile_android',
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gateway ${res.status}: ${body}`);
  }
  const json = (await res.json()) as GatewayResponse;
  return { text: json.text, actions: json.actions };
}

// Unused by the gateway (gateway loads history from Supabase) but kept so
// the runner can fall back to direct Anthropic mode without changes.
export type _ChatTurn = ChatTurn;
