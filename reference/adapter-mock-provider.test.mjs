import assert from 'node:assert/strict';
import { widgetSubmissionToRequest } from './adapter.mjs';
import { handleWireRequest } from './mock-provider.mjs';
import { validateDocument } from './validator.mjs';

const request = widgetSubmissionToRequest({ text: 'Need an example consultation', sourceSurface: 'public-widget' }, {
  messageId: 'msg-adapter-001', traceId: 'trace-adapter-001', demandId: 'demand-adapter-001',
  idempotencyKey: 'idem-adapter-001', createdAt: '2026-08-02T00:00:00Z',
});
assert.equal((await validateDocument('wire-request', request)).valid, true);
const { accepted, terminal } = handleWireRequest(request);
assert.equal((await validateDocument('wire-accepted', accepted)).valid, true);
assert.equal((await validateDocument('wire-terminal', terminal)).valid, true);
assert.equal(accepted.trace_id, request.trace_id);
assert.equal(terminal.trace_id, request.trace_id);
assert.equal(accepted.in_reply_to_request_id, request.message_id);
assert.equal(terminal.in_reply_to_request_id, request.message_id);
assert.throws(() => widgetSubmissionToRequest({ text: '  ' }), /non-empty/);
console.log('Adapter/mock-provider interoperability passed.');
