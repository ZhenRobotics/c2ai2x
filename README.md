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

The Core `Demand.identity.protocol_version` and `Envelope.protocol_version`
fields are fixed to the literal `v1`. A request that embeds an
`AuthorizationGrant` must use the same `demand_id` as its embedded Demand;
this cross-field rule is checked during conformance rather than by validating
either individual Core schema alone.

## Contents

- `schemas/` — five JSON Schema definitions.
- `examples/` — five illustrative protocol documents.
- `conformance/manifest.json` and `conformance/wire-manifest.json` —
  machine-readable core-example and wire-conformance associations.
- `index.json` — machine-readable artifact index.
- `integrity.json` — SHA-256 digests supplied with the public snapshot.
- `spec/protocol-assets.md` — static-asset and integrity boundaries.
- `spec/c2ai2x-core-v1.md` — Core v1 wire semantics and lifecycle.
- `wire/` and `fixtures/` — portable request and lifecycle contracts. A wire
  request embeds a complete Core `Demand` and optional `AuthorizationGrant`.
  A provider returns either a synchronous completed response or `accepted`,
  followed by one workflow-linked `completed`, `failed`, or `cancelled`
  terminal event; each reply identifies the request it answers and cancellation
  includes a reason. The artifact index includes both positive and negative
  wire fixtures.
- `reference/` — offline validator, adapter and deterministic mock provider.
- `reference/validator.mjs` — offline, zero-dependency reference validator for the published schemas.
- `scripts/validate.mjs` — repository validation for integrity, validator tests, and sensitive-content scanning.
- `CONTRIBUTING.md` and `GOVERNANCE.md` — contribution checks and the protocol-asset governance boundary.

## Runtime boundary

C2AI2X Core v1 is a public interchange contract derived from observed
boundaries between Zhen's Widget-facing Platform and its admitted workflow
runtime. It is intentionally independent of either runtime implementation.
The reference-derived relationship, verification scope, and non-claims are
documented in [`docs/reference-derived-runtime-boundary.md`](docs/reference-derived-runtime-boundary.md).

The repository verifies offline schemas, lifecycle conformance, and its local
reference adapter/mock provider. It does not claim to prove a production
deployment, live external interoperability, or third-party adoption.

## Using the assets

Select a schema from `schemas/` to validate a document, then compare it
with the corresponding fixture in `examples/`. The manifest identifies the
published example and schema pairs. Consumers are responsible for choosing
their own JSON Schema validator and for any application-specific behavior.

## Reference validator and repository checks

The included reference validator is an offline, zero-dependency tool for the
published schemas; it is not an SDK, runtime, gateway, or service. Run it with
one of `demand`, `envelope`, `authorization_grant`, `protocol_event`,
`protocol_error`, `wire-request`, `wire-accepted`, `wire-sync-completed`, or
`wire-terminal` and a JSON document:

```bash
node reference/validator.mjs demand examples/demand.chat.json
```

Before proposing changes, run the repository checks:

```bash
npm run validate
```

This verifies the published-asset integrity manifest (including the indexed
wire schemas, fixtures, and wire-conformance manifest), runs the reference
validator and wire lifecycle tests, and scans the repository for private-key
and credential-token patterns. Contribution and governance boundaries are described in
[`CONTRIBUTING.md`](CONTRIBUTING.md) and [`GOVERNANCE.md`](GOVERNANCE.md).

## SHA-256 verification

For each entry in `integrity.json`, calculate the SHA-256 digest of the
relative path from the repository root and compare it with the entry's
`sha256` value. A mismatch means the asset should not be treated as the
published snapshot. The integrity manifest is an integrity aid; it does not
make a trust, compatibility, or service availability guarantee.

## License

These assets are licensed under the Apache License, Version 2.0. See
[LICENSE](LICENSE).
