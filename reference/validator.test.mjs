import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { promisify } from 'node:util';

import { validateDocument } from './validator.mjs';

const execFileAsync = promisify(execFile);
const root = fileURLToPath(new URL('../', import.meta.url));
const node = process.execPath;

const examples = [
  ['demand', 'examples/demand.chat.json'],
  ['envelope', 'examples/envelope.routing.json'],
  ['authorization_grant', 'examples/authorization_grant.handoff.json'],
  ['protocol_event', 'examples/protocol_event.match_shortlisted.json'],
  ['protocol_error', 'examples/protocol_error.scope_denied.json'],
];

for (const [schemaName, example] of examples) {
  test(`${schemaName} public example passes the CLI`, async () => {
    const { stdout, stderr } = await execFileAsync(
      node,
      ['reference/validator.mjs', schemaName, example],
      { cwd: root },
    );

    assert.equal(stderr, '');
    assert.equal(
      stdout,
      `VALID: ${example} conforms to schemas/${schemaName}.schema.json\n`,
    );
  });
}

const invalidDocuments = [
  ['demand', { identity: {} }, '/identity/demand_id'],
  ['envelope', { envelope_id: 'env_1' }, '/protocol'],
  ['authorization_grant', { grant_id: 'grant_1' }, '/demand_id'],
  ['protocol_event', { event_id: 'event_1' }, '/demand_id'],
  ['protocol_error', { error_code: 'scope_denied' }, '/error_message'],
];

for (const [schemaName, document, pointer] of invalidDocuments) {
  test(`${schemaName} invalid document reports its JSON Pointer`, async () => {
    const result = await validateDocument(schemaName, document);

    assert.equal(result.valid, false);
    assert.ok(result.errors.some((error) => error.pointer === pointer));
  });
}

test('validator source does not use environment, network, or HTTP modules', async () => {
  const source = await readFile(new URL('./validator.mjs', import.meta.url), 'utf8');

  assert.doesNotMatch(source, /process\.env|node:(?:http|https|net|dns)|\bfetch\s*\(/);
});
