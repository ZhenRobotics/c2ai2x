#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const schemaNames = new Set([
  'demand',
  'envelope',
  'authorization_grant',
  'protocol_event',
  'protocol_error',
]);
const knownKeywords = new Set([
  '$defs', '$ref', 'additionalProperties', 'anyOf', 'const', 'default', 'enum',
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

function resolveRef(rootSchema, ref) {
  const match = /^#\/\$defs\/([^/]+)$/.exec(ref);
  if (!match || !rootSchema.$defs || !(match[1] in rootSchema.$defs)) {
    throw new SchemaError(`Unsupported or unresolved $ref ${JSON.stringify(ref)}.`);
  }
  return rootSchema.$defs[match[1]];
}

function validateAgainst(rootSchema, schema, value, pointer) {
  const errors = [];
  const add = (keyword, message) => errors.push(schemaError(pointer, keyword, message));

  if ('$ref' in schema) {
    errors.push(...validateAgainst(rootSchema, resolveRef(rootSchema, schema.$ref), value, pointer));
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
    value.forEach((item, index) => errors.push(...validateAgainst(rootSchema, schema.items, item, joinPointer(pointer, index))));
  }
  if (isObject(value)) {
    const properties = schema.properties ?? {};
    for (const name of schema.required ?? []) {
      if (!(name in value)) errors.push(schemaError(joinPointer(pointer, name), 'required', 'required property is missing'));
    }
    for (const [name, propertySchema] of Object.entries(properties)) {
      if (name in value) errors.push(...validateAgainst(rootSchema, propertySchema, value[name], joinPointer(pointer, name)));
    }
    if (schema.additionalProperties === false) {
      for (const name of Object.keys(value)) {
        if (!(name in properties)) errors.push(schemaError(joinPointer(pointer, name), 'additionalProperties', 'property is not permitted'));
      }
    }
  }
  for (const keyword of ['anyOf', 'oneOf']) {
    if (!(keyword in schema)) continue;
    const passingBranches = schema[keyword].filter((branch) => validateAgainst(rootSchema, branch, value, pointer).length === 0);
    if ((keyword === 'anyOf' && passingBranches.length === 0) || (keyword === 'oneOf' && passingBranches.length !== 1)) {
      add(keyword, keyword === 'anyOf' ? 'value does not match any permitted schema' : 'value must match exactly one permitted schema');
    }
  }
  return errors;
}

async function loadSchema(schemaName) {
  if (!schemaNames.has(schemaName)) {
    throw new SchemaError(`Unknown schema ${JSON.stringify(schemaName)}. Allowed: ${[...schemaNames].join(', ')}.`);
  }
  const schemaPath = path.join(root, 'schemas', `${schemaName}.schema.json`);
  const schema = JSON.parse(await readFile(schemaPath, 'utf8'));
  assertSupportedSchema(schema);
  return schema;
}

export async function validateDocument(schemaName, document) {
  const schema = await loadSchema(schemaName);
  const errors = validateAgainst(schema, schema, document, '');
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
    process.stdout.write(`VALID: ${jsonFile} conforms to schemas/${schemaName}.schema.json\n`);
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
