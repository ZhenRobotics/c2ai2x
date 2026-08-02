import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

import { validateDocument } from './validator.mjs';

const manifestUrl = new URL('../conformance/wire-manifest.json', import.meta.url);
const manifest = JSON.parse(await readFile(manifestUrl, 'utf8'));
const index = JSON.parse(await readFile(new URL('../index.json', import.meta.url), 'utf8'));
const schemaNames = new Map([
  ['../wire/request-envelope.schema.json', 'wire-request'],
  ['../wire/accepted-response.schema.json', 'wire-accepted'],
  ['../wire/synchronous-completed-response.schema.json', 'wire-sync-completed'],
  ['../wire/terminal-event.schema.json', 'wire-terminal'],
]);

async function readFixture(fixture) {
  return JSON.parse(await readFile(new URL(fixture, manifestUrl), 'utf8'));
}

async function validateFixture(schema, fixture) {
  return validateDocument(schemaNames.get(schema) ?? schema, await readFixture(fixture));
}

function lifecycleFailure(sequence, messages) {
  const [request, response, terminal] = messages;
  if (request.kind !== 'request') return 'request-first';
  const authorizationGrant = request.payload.authorization_grant;
  if (authorizationGrant && authorizationGrant.demand_id !== request.payload.demand.identity.demand_id) {
    return 'authorization-grant-demand-id';
  }
  if (sequence.mode === 'synchronous') {
    if (messages.length !== 2 || response.kind !== 'completed') return 'synchronous-completed-response';
    if (response.trace_id !== request.trace_id) return 'trace-id';
    if (response.in_reply_to_request_id !== request.message_id) return 'in-reply-to-request-id';
    if ('workflow_id' in response.payload) return 'synchronous-workflow-id';
    return null;
  }
  if (sequence.mode !== 'asynchronous' || messages.length !== 3) return 'accepted-before-terminal';
  if (response.kind !== 'accepted') return 'accepted-before-terminal';
  if (!['completed', 'failed', 'cancelled'].includes(terminal.kind)) return 'terminal-kind';
  if (response.trace_id !== request.trace_id || terminal.trace_id !== request.trace_id) return 'trace-id';
  if (response.in_reply_to_request_id !== request.message_id || terminal.in_reply_to_request_id !== request.message_id) {
    return 'in-reply-to-request-id';
  }
  if (terminal.payload.workflow_id !== response.payload.workflow_id) return 'workflow-id';
  return null;
}

test('wire manifest paths resolve relative to the manifest', async () => {
  const manifestEntries = [
    ...manifest.fixtures,
    ...manifest.sequences.flatMap(({ messages }) => messages),
    ...manifest.negative_cases,
    ...manifest.negative_sequences.flatMap(({ messages }) => messages),
  ];
  for (const { schema, fixture } of manifestEntries) {
    assert.match(schema, /^\.\.\/wire\//, `${schema}: schema path`);
    assert.match(fixture, /^\.\.\/fixtures\//, `${fixture}: fixture path`);
    await access(new URL(schema, manifestUrl));
    await access(new URL(fixture, manifestUrl));
  }
});

test('artifact index lists every negative wire fixture', () => {
  const positiveFixtures = new Set(manifest.fixtures.map(({ fixture }) => fixture));
  const manifestNegativeFixtures = new Set([
    ...manifest.negative_cases.map(({ fixture }) => fixture.replace(/^\.\.\//, '')),
    ...manifest.negative_sequences.flatMap(({ messages }) => messages
      .map(({ fixture }) => fixture)
      .filter((fixture) => !positiveFixtures.has(fixture))
      .map((fixture) => fixture.replace(/^\.\.\//, ''))),
  ]);

  assert.deepEqual(
    [...index.artifacts.wire.negative_fixtures].sort(),
    [...manifestNegativeFixtures].sort(),
  );
});

test('every published positive wire fixture validates against its declared schema', async () => {
  assert.ok(Array.isArray(manifest.fixtures));
  for (const { schema, fixture } of manifest.fixtures) {
    const result = await validateFixture(schema, fixture);
    assert.equal(result.valid, true, `${fixture}: ${JSON.stringify(result.errors)}`);
  }
});

test('wire request rejects an incomplete embedded Core Demand', async () => {
  const result = await validateFixture('wire-request', '../fixtures/invalid-wire-request-incomplete-demand.json');

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.pointer === '/payload/demand/identity/protocol_version'));
});

test('wire request rejects an incomplete embedded AuthorizationGrant', async () => {
  const result = await validateFixture('wire-request', '../fixtures/invalid-wire-request-incomplete-authorization-grant.json');

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.pointer === '/payload/authorization_grant/demand_id'));
});

test('published lifecycle sequences preserve trace and asynchronous workflow identity', async () => {
  assert.ok(Array.isArray(manifest.sequences));
  for (const sequence of manifest.sequences) {
    const messages = [];
    for (const step of sequence.messages) {
      const result = await validateFixture(step.schema, step.fixture);
      assert.equal(result.valid, true, `${sequence.name}/${step.fixture}: ${JSON.stringify(result.errors)}`);
      messages.push(await readFixture(step.fixture));
    }

    const [request, response, terminal] = messages;
    assert.equal(response.trace_id, request.trace_id, `${sequence.name}: response trace_id`);
    assert.equal(response.in_reply_to_request_id, request.message_id, `${sequence.name}: response request binding`);
    if (sequence.mode === 'synchronous') {
      assert.equal(messages.length, 2, `${sequence.name}: synchronous sequence length`);
      assert.equal(response.kind, 'completed', `${sequence.name}: synchronous outcome`);
      assert.equal('workflow_id' in response.payload, false, `${sequence.name}: no workflow_id for synchronous completion`);
      continue;
    }

    assert.equal(sequence.mode, 'asynchronous', `${sequence.name}: known sequence mode`);
    assert.equal(response.kind, 'accepted', `${sequence.name}: accepted response`);
    assert.equal(terminal.trace_id, request.trace_id, `${sequence.name}: terminal trace_id`);
    assert.equal(terminal.in_reply_to_request_id, request.message_id, `${sequence.name}: terminal request binding`);
    assert.equal(terminal.payload.workflow_id, response.payload.workflow_id, `${sequence.name}: terminal workflow_id`);
  }
});

test('published negative cases remain invalid', async () => {
  assert.ok(Array.isArray(manifest.negative_cases));
  for (const { name, schema, fixture, expected_keyword } of manifest.negative_cases) {
    const result = await validateFixture(schema, fixture);
    assert.equal(result.valid, false, `${name} must be rejected`);
    assert.ok(result.errors.some((error) => error.keyword === expected_keyword), `${name}: expected ${expected_keyword}`);
  }
});

test('published negative lifecycle sequences are rejected after individual schema validation', async () => {
  assert.ok(Array.isArray(manifest.negative_sequences));
  for (const sequence of manifest.negative_sequences) {
    const messages = [];
    for (const step of sequence.messages) {
      const result = await validateFixture(step.schema, step.fixture);
      assert.equal(result.valid, true, `${sequence.name}/${step.fixture}: schema validation`);
      messages.push(await readFixture(step.fixture));
    }
    assert.equal(lifecycleFailure(sequence, messages), sequence.expected_rule, sequence.name);
  }
});

console.log('Wire conformance contract loaded.');
