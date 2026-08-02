# C2AI2X Reference Validator

This directory contains a zero-dependency, offline Node.js reference validator
for the public C2AI2X Core Protocol `v1` schemas. It is a protocol-asset tool,
not an SDK, runtime, gateway, platform API client, or robot-control component.

## Usage

```bash
node reference/validator.mjs <schema-name> <json-file>
```

`schema-name` is one of `demand`, `envelope`, `authorization_grant`,
`protocol_event`, or `protocol_error`. A valid document exits with status 0 and
prints its schema. An invalid document exits with status 1 and reports each
JSON Pointer, violated rule, and reason.

The validator reads only the selected local JSON document and the matching
local schema. It does not read environment variables, access a network, or
call HTTP or platform APIs.

## Supported schema vocabulary

The executable supports the validation keywords used by the published assets:
`type`, `required`, `properties`, `additionalProperties`, `items`, `$ref`,
`$defs`, `oneOf`, `anyOf`, `enum`, `const`, `pattern`, `format: date-time`,
`minItems`, and `minLength`. It also recognizes the published annotation
keywords `title` and `default`; they do not alter validation results. Any other
schema keyword fails explicitly instead of being silently ignored.

`anyOf`, `title`, and `default` are documented here because they occur in the
current public schemas even though they were omitted from the original compact
design-keyword list.
