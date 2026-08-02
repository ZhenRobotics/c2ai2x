/**
 * Deterministic local provider for wire-contract demonstrations. It does not
 * retain data, contact a service, or represent a production provider.
 */
export function handleWireRequest(request, options = {}) {
  if (request?.kind !== 'request') throw new TypeError('expected a request message');
  const prefix = options.messagePrefix ?? 'mock';
  const workflowId = `${prefix}-workflow-${request.message_id}`;
  const accepted = {
    standard: 'c2ai2x-core', version: 'v1', message_id: `${prefix}-accepted-${request.message_id}`,
    trace_id: request.trace_id, in_reply_to_request_id: request.message_id,
    kind: 'accepted', payload: { workflow_id: workflowId },
  };
  const terminal = {
    standard: 'c2ai2x-core', version: 'v1', message_id: `${prefix}-completed-${request.message_id}`,
    trace_id: request.trace_id, in_reply_to_request_id: request.message_id, kind: 'completed',
    payload: { workflow_id: workflowId, result: { status: 'fixture_completed' } },
  };
  return { accepted, terminal };
}
