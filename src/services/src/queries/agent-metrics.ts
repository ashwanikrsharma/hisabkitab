import { getServerClient } from '../client';

export type LogAgentMetricInput = {
  agentName: string;
  promptVersion: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  success: boolean;
  errorMessage?: string;
  groupId?: string;
  userId?: string;
};

/**
 * Logs a single AI agent metric row.
 * Uses the service_role client so RLS (service_role-only policy) is satisfied.
 */
export async function logAgentMetric(input: LogAgentMetricInput): Promise<void> {
  const db = getServerClient();

  const { error } = await db.from('agent_metrics').insert({
    agent_name: input.agentName,
    prompt_version: input.promptVersion,
    input_tokens: input.inputTokens,
    output_tokens: input.outputTokens,
    latency_ms: input.latencyMs,
    success: input.success,
    error_message: input.errorMessage ?? null,
    group_id: input.groupId ?? null,
    user_id: input.userId ?? null,
  });

  if (error) throw new Error(`logAgentMetric: ${error.message}`);
}
