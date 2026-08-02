# Changelog

## Unreleased

- Repaired the Core v1 wire request so embedded `Demand` and optional `AuthorizationGrant` are validated against their published schemas.
- Split synchronous completed responses from accepted-workflow terminal events; asynchronous `completed`, `failed`, and `cancelled` outcomes now require a workflow reference, and cancellation requires a reason.
- Added manifest-driven positive and negative wire lifecycle conformance sequences, including ordering, trace, and workflow-link checks.
- Indexed and integrity-protected the published wire schemas, fixtures, and wire conformance manifest.
- Added an offline, zero-dependency reference validator for the published C2AI2X schemas.
- Added repository validation tooling for asset integrity, reference-validator tests, and sensitive-content scanning.
- Added contribution guidance and governance boundaries for the static protocol-asset snapshot.

## v1.0.0

- Initial public asset snapshot for `c2ai2x-core/v1`.
