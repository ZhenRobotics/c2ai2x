import { randomUUID } from 'node:crypto';

/**
 * Converts a public-facing widget submission into a portable C2AI2X request.
 * This is a local data transformation only: it makes no HTTP calls and does
 * not admit, authenticate, or execute a request.
 */
export function widgetSubmissionToRequest(submission, options = {}) {
  if (!submission || typeof submission !== 'object' || Array.isArray(submission)) {
    throw new TypeError('submission must be an object');
  }
  const text = submission.text;
  if (typeof text !== 'string' || text.trim() === '') {
    throw new TypeError('submission.text must be a non-empty string');
  }
  const now = options.createdAt ?? new Date().toISOString();
  const messageId = options.messageId ?? randomUUID();
  const traceId = options.traceId ?? randomUUID();
  const demandId = options.demandId ?? `demand-${messageId}`;
  const idempotencyKey = options.idempotencyKey ?? messageId;

  return {
    standard: 'c2ai2x-core', version: 'v1', message_id: messageId,
    trace_id: traceId, idempotency_key: idempotencyKey, kind: 'request',
    payload: {
      demand: {
        identity: {
          demand_id: demandId, protocol_version: 'v1', created_at: now,
          source_surface: submission.sourceSurface ?? 'widget', source_type: 'widget',
        },
        intent: {
          category: 'consultation', goal: 'intake', requested_outcome: 'provider_response',
          priority: 'normal', urgency: 'medium', budget: {}, timeline: {},
        },
        input_context: { raw_input: text, structured_summary: submission.summary ?? text },
        constraints: {},
        authorization: { redaction_policy: 'default', revocable: true },
        state: {
          demand_state: 'submitted', routing_status: 'pending', execution_status: 'not_started',
          settlement_status: 'not_applicable',
        },
      },
    },
  };
}
