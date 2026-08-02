# C2AI2X Core Protocol Assets

This is the Apache-2.0 public asset snapshot for `c2ai2x-core/v1`.
It contains static JSON Schemas, illustrative JSON examples, a conformance
manifest, and an integrity manifest for review and reuse.

## Scope

The snapshot is a protocol-asset repository only. It is not a runtime or
gateway and does not provide a service endpoint, SDK, execution environment,
deployment configuration, credentials, production data, or operational
commitments.
The included examples are illustrative fixtures, not live records.

This README is the human-facing inventory. `index.json` is included as the
machine-readable artifact index referenced by the conformance manifest.

## Contents

- `schemas/` — five JSON Schema definitions.
- `examples/` — five illustrative protocol documents.
- `conformance/manifest.json` — schema-to-example associations.
- `index.json` — machine-readable artifact index.
- `integrity.json` — SHA-256 digests supplied with the public snapshot.
- `spec/protocol-assets.md` — static-asset and integrity boundaries.

## Using the assets

Select a schema from `schemas/` to validate a document, then compare it
with the corresponding fixture in `examples/`. The manifest identifies the
published example and schema pairs. Consumers are responsible for choosing
their own JSON Schema validator and for any application-specific behavior.

## SHA-256 verification

For each entry in `integrity.json`, calculate the SHA-256 digest of the
relative path from the repository root and compare it with the entry's
`sha256` value. A mismatch means the asset should not be treated as the
published snapshot. The integrity manifest is an integrity aid; it does not
make a trust, compatibility, or service availability guarantee.

## License

These assets are licensed under the Apache License, Version 2.0. See
[LICENSE](LICENSE).
