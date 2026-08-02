#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const sensitivePatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\bgh[pousr]_[A-Za-z0-9]{30,}\b/,
  /\bAKIA[0-9A-Z]{16}\b/,
];

function artifactPath(relativePath) {
  const resolved = path.resolve(root, relativePath);
  if (!resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error(`Integrity artifact escapes repository root: ${relativePath}`);
  }
  return resolved;
}

async function verifyIntegrity() {
  const integrity = JSON.parse(await readFile(path.join(root, 'integrity.json'), 'utf8'));
  if (integrity.algorithm !== 'sha256' || !Array.isArray(integrity.artifacts)) {
    throw new Error('integrity.json must declare sha256 artifacts.');
  }
  for (const artifact of integrity.artifacts) {
    const contents = await readFile(artifactPath(artifact.path));
    const actual = createHash('sha256').update(contents).digest('hex');
    if (actual !== artifact.sha256) {
      throw new Error(`Integrity mismatch for ${artifact.path}.`);
    }
  }
  process.stdout.write(`Integrity: ${integrity.artifacts.length} published assets verified.\n`);
}

async function filesBelow(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === '.git') continue;
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await filesBelow(entryPath));
    else if (entry.isFile()) files.push(entryPath);
  }
  return files;
}

async function scanSensitiveContent() {
  const findings = [];
  for (const file of await filesBelow(root)) {
    const contents = await readFile(file, 'utf8');
    if (sensitivePatterns.some((pattern) => pattern.test(contents))) {
      findings.push(path.relative(root, file));
    }
  }
  if (findings.length > 0) throw new Error(`Sensitive-content pattern found in: ${findings.join(', ')}`);
  process.stdout.write('Sensitive scan: no private-key or credential-token patterns found.\n');
}

async function main() {
  await verifyIntegrity();
  execFileSync(process.execPath, ['--test', 'reference/validator.test.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
  await scanSensitiveContent();
}

main().catch((error) => {
  process.stderr.write(`VALIDATION ERROR: ${error.message}\n`);
  process.exitCode = 1;
});
