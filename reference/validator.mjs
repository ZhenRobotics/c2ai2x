#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const schemaFiles = new Map([
  'demand',
  'envelope',
  'authorization_grant',
  'protocol_event',
  'protocol_error',
].map((name) => [name, `schemas/${name}.schema.json`]));
schemaFiles.set('wire-request', 'wire/request-envelope.schema.json');
schemaFiles.set('wire-accepted', 'wire/accepted-response.schema.json');
schemaFiles.set('wire-sync-completed', 'wire/synchronous-completed-response.schema.json');
schemaFiles.set('wire-terminal', 'wire/terminal-event.schema.json');
const knownKeywords = new Set([
  '$defs', '$ref', '$schema', 'additionalProperties', 'anyOf', 'const', 'default', 'enum',
  'format', 'items', 'minItems', 'minLength', 'oneOf', 'pattern', 'properties',
  'required', 'title', 'type',
]);

class SchemaError extends Error {}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function escapePointer(segment) {
  return String(segment).replace(/~/g, '~0').replace(/\//g, '~1');
}

function joinPointer(pointer, segment) {
  return `${pointer}/${escapePointer(segment)}`;
}

function typeMatches(value, type) {
  if (type === 'null') return value === null;
  if (type === 'array') return Array.isArray(value);
  if (type === 'object') return isObject(value);
  return typeof value === type;
}

function equalJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function validDateTime(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-](\d{2}):(\d{2}))$/.exec(value);
  if (!match) return false;

  const [, yearText, monthText, dayText, hourText, minuteText, secondText, offsetHourText, offsetMinuteText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const offsetHour = offsetHourText === undefined ? 0 : Number(offsetHourText);
  const offsetMinute = offsetMinuteText === undefined ? 0 : Number(offsetMinuteText);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth
    && hour <= 23 && minute <= 59 && second <= 59
    && offsetHour <= 23 && offsetMinute <= 59;
}

function schemaError(pointer, keyword, message) {
  return { pointer, keyword, message };
}

function assertSupportedSchema(schema, pointer = '#') {
  if (!isObject(schema)) {
    throw new SchemaError(`Schema at ${pointer} must be an object.`);
  }

  for (const keyword of Object.keys(schema)) {
    if (!knownKeywords.has(keyword)) {
      throw new SchemaError(`Unsupported schema keyword ${JSON.stringify(keyword)} at ${pointer}.`);
    }
  }

  if ('$defs' in schema) {
    if (!isObject(schema.$defs)) throw new SchemaError(`$defs at ${pointer} must be an object.`);
    for (const [name, definition] of Object.entries(schema.$defs)) {
      assertSupportedSchema(definition, `${pointer}/$defs/${escapePointer(name)}`);
    }
  }
  if ('properties' in schema) {
    if (!isObject(schema.properties)) throw new SchemaError(`properties at ${pointer} must be an object.`);
    for (const [name, property] of Object.entries(schema.properties)) {
      assertSupportedSchema(property, `${pointer}/properties/${escapePointer(name)}`);
    }
  }
  if ('items' in schema) assertSupportedSchema(schema.items, `${pointer}/items`);
  for (const keyword of ['anyOf', 'oneOf']) {
    if (keyword in schema) {
      if (!Array.isArray(schema[keyword])) throw new SchemaError(`${keyword} at ${pointer} must be an array.`);
      schema[keyword].forEach((branch, index) => assertSupportedSchema(branch, `${pointer}/${keyword}/${index}`));
    }
  }
}

function isPathBelowRoot(schemaPath) {
  return schemaPath.startsWith(`${root}${path.sep}`);
}

function decodePointerSegment(segment) {
  return segment.replace(/~1/g, '/').replace(/~0/g, '~');
}

function splitReference(document, ref) {
  if (typeof ref !== 'string') throw new SchemaError(`$ref in ${document.path} must be a string.`);
  const hashIndex = ref.indexOf('#');
  const relativePath = hashIndex === -1 ? ref : ref.slice(0, hashIndex);
  const fragment = hashIndex === -1 ? '' : ref.slice(hashIndex);
  if (relativePath === '') return { path: document.path, fragment };
  if (relativePath.includes(':')) throw new SchemaError(`Only local file $ref values are supported: ${JSON.stringify(ref)}.`);

  const referencedPath = path.resolve(path.dirname(document.path), relativePath);
  if (!isPathBelowRoot(referencedPath)) {
    throw new SchemaError(`Local $ref escapes the published asset root: ${JSON.stringify(ref)}.`);
  }
  return { path: referencedPath, fragment };
}

function resolvePointer(schema, fragment, ref) {
  if (fragment === '' || fragment === '#') return schema;
  if (!fragment.startsWith('#/')) throw new SchemaError(`Unsupported $ref fragment ${JSON.stringify(ref)}.`);

  let resolved = schema;
  for (const rawSegment of fragment.slice(2).split('/')) {
    const segment = decodePointerSegment(rawSegment);
    if (!isObject(resolved) || !(segment in resolved)) {
      throw new SchemaError(`Unresolved $ref ${JSON.stringify(ref)}.`);
    }
    resolved = resolved[segment];
  }
  if (!isObject(resolved)) throw new SchemaError(`$ref ${JSON.stringify(ref)} must resolve to a schema object.`);
  return resolved;
}

function resolveRef(document, ref, documents) {
  const target = splitReference(document, ref);
  const targetDocument = documents.get(target.path);
  if (!targetDocument) throw new SchemaError(`Unresolved local $ref ${JSON.stringify(ref)}.`);
  return { document: targetDocument, schema: resolvePointer(targetDocument.schema, target.fragment, ref) };
}

function validateAgainst(document, schema, value, pointer, documents) {
  const errors = [];
  const add = (keyword, message) => errors.push(schemaError(pointer, keyword, message));

  if ('$ref' in schema) {
    const resolved = resolveRef(document, schema.$ref, documents);
    errors.push(...validateAgainst(resolved.document, resolved.schema, value, pointer, documents));
  }
  if ('type' in schema && !typeMatches(value, schema.type)) {
    add('type', `expected ${schema.type}, received ${value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value}`);
    return errors;
  }
  if ('const' in schema && !equalJson(value, schema.const)) add('const', 'value does not match the required constant');
  if ('enum' in schema && !schema.enum.some((candidate) => equalJson(value, candidate))) {
    add('enum', 'value is not one of the permitted values');
  }
  if ('pattern' in schema && typeof value === 'string' && !(new RegExp(schema.pattern).test(value))) {
    add('pattern', `string does not match ${schema.pattern}`);
  }
  if ('format' in schema && schema.format === 'date-time' && typeof value === 'string' && !validDateTime(value)) {
    add('format', 'string is not a valid date-time');
  }
  if ('minLength' in schema && typeof value === 'string' && value.length < schema.minLength) {
    add('minLength', `string length must be at least ${schema.minLength}`);
  }
  if ('minItems' in schema && Array.isArray(value) && value.length < schema.minItems) {
    add('minItems', `array length must be at least ${schema.minItems}`);
  }
  if ('items' in schema && Array.isArray(value)) {
    value.forEach((item, index) => errors.push(...validateAgainst(document, schema.items, item, joinPointer(pointer, index), documents)));
  }
  if (isObject(value)) {
    const properties = schema.properties ?? {};
    for (const name of schema.required ?? []) {
      if (!(name in value)) errors.push(schemaError(joinPointer(pointer, name), 'required', 'required property is missing'));
    }
    for (const [name, propertySchema] of Object.entries(properties)) {
      if (name in value) errors.push(...validateAgainst(document, propertySchema, value[name], joinPointer(pointer, name), documents));
    }
    if (schema.additionalProperties === false) {
      for (const name of Object.keys(value)) {
        if (!(name in properties)) errors.push(schemaError(joinPointer(pointer, name), 'additionalProperties', 'property is not permitted'));
      }
    }
  }
  for (const keyword of ['anyOf', 'oneOf']) {
    if (!(keyword in schema)) continue;
    const passingBranches = schema[keyword].filter((branch) => validateAgainst(document, branch, value, pointer, documents).length === 0);
    if ((keyword === 'anyOf' && passingBranches.length === 0) || (keyword === 'oneOf' && passingBranches.length !== 1)) {
      add(keyword, keyword === 'anyOf' ? 'value does not match any permitted schema' : 'value must match exactly one permitted schema');
    }
  }
  return errors;
}

function externalReferences(schema) {
  const references = [];
  const visit = (candidate) => {
    if (!isObject(candidate)) return;
    if ('$ref' in candidate && typeof candidate.$ref === 'string' && !candidate.$ref.startsWith('#')) {
      references.push(candidate.$ref);
    }
    if ('$defs' in candidate) Object.values(candidate.$defs).forEach(visit);
    if ('properties' in candidate) Object.values(candidate.properties).forEach(visit);
    if ('items' in candidate) visit(candidate.items);
    for (const keyword of ['anyOf', 'oneOf']) {
      if (Array.isArray(candidate[keyword])) candidate[keyword].forEach(visit);
    }
  };
  visit(schema);
  return references;
}

async function loadSchemaDocument(schemaPath, documents) {
  const normalizedPath = path.resolve(schemaPath);
  if (!isPathBelowRoot(normalizedPath)) throw new SchemaError(`Schema path escapes the published asset root: ${schemaPath}.`);
  if (documents.has(normalizedPath)) return documents.get(normalizedPath);

  const schema = JSON.parse(await readFile(normalizedPath, 'utf8'));
  assertSupportedSchema(schema);
  const document = { path: normalizedPath, schema };
  documents.set(normalizedPath, document);
  for (const ref of externalReferences(schema)) {
    const target = splitReference(document, ref);
    await loadSchemaDocument(target.path, documents);
  }
  return document;
}

async function loadSchema(schemaName) {
  if (!schemaFiles.has(schemaName)) {
    throw new SchemaError(`Unknown schema ${JSON.stringify(schemaName)}. Allowed: ${[...schemaFiles.keys()].join(', ')}.`);
  }
  const schemaPath = path.join(root, schemaFiles.get(schemaName));
  const documents = new Map();
  const document = await loadSchemaDocument(schemaPath, documents);
  return { document, documents };
}

export async function validateDocument(schemaName, document) {
  const loadedSchema = await loadSchema(schemaName);
  const errors = validateAgainst(loadedSchema.document, loadedSchema.document.schema, document, '', loadedSchema.documents);
  return { valid: errors.length === 0, errors };
}

async function main(argumentsList) {
  const [schemaName, jsonFile] = argumentsList;
  if (argumentsList.length !== 2) {
    throw new SchemaError('Usage: node reference/validator.mjs <schema-name> <json-file>');
  }
  let document;
  try {
    document = JSON.parse(await readFile(path.resolve(jsonFile), 'utf8'));
  } catch (error) {
    throw new SchemaError(`Cannot read JSON document ${JSON.stringify(jsonFile)}: ${error.message}`);
  }
  const result = await validateDocument(schemaName, document);
  if (result.valid) {
    process.stdout.write(`VALID: ${jsonFile} conforms to ${schemaFiles.get(schemaName)}\n`);
    return;
  }
  process.stderr.write(`INVALID: ${jsonFile}\n`);
  for (const error of result.errors) {
    process.stderr.write(`${error.pointer || '/'}: ${error.keyword}: ${error.message}\n`);
  }
  process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`ERROR: ${error.message}\n`);
    process.exitCode = 1;
  });
}
