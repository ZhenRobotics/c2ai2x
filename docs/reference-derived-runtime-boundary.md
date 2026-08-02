# C2AI2X Runtime Boundary: Reference-Derived Summary

## Status

This is a reference-derived architecture note for the public C2AI2X protocol
repository. It describes observed boundaries in `zhen-platform-core` and
`zhen-brain-core`; it does not modify, configure, deploy, or claim control of
either repository.

## Observed execution boundary

The referenced runtime documentation and contracts establish the following
direction of travel:

```text
business site / Widget
  -> zhen-platform-core public admission and orchestration
  -> zhen-brain-core admitted workflow execution
  -> zhen-platform-core result and status ownership
```

Platform owns public ingress, identity and authorization interpretation,
tenancy, entitlement, quota, audit, and translation into the internal Brain
execution payload. Brain consumes only Platform-admitted work; it is not a
partner or Widget public ingress.

## Relation to C2AI2X Core v1

The public protocol is intentionally narrower than the referenced runtime:

| C2AI2X Core v1 | Reference-derived interpretation |
| --- | --- |
| `Demand` | Portable expression of work context before runtime-specific routing. |
| `AuthorizationGrant` | Optional portable context; not a replacement for Platform admission, API key processing, or entitlement state. |
| `request` | An interchange representation, not evidence that a Widget calls Brain directly. |
| `accepted` + terminal event | A portable lifecycle projection of an admitted asynchronous workflow. |
| `completed` | A portable projection of a synchronous outcome. |

This mapping explains why the protocol preserves request identity, trace,
request-reply linkage, workflow identity and explicit terminal states, while
deliberately omitting credentials, billing state, production configuration,
robot controls and runtime-only payloads.

## What is verified by the public repository

The public repository verifies static contract behavior only:

- Core and wire schema validation;
- cross-message lifecycle, trace and workflow linkage;
- a local adapter and deterministic mock provider;
- positive and negative conformance fixtures.

It does not verify a live Widget deployment, production Platform-to-Brain
traffic, third-party interoperability, performance, availability, or partner
adoption.

## Safe path to stronger evidence

Any future operator-controlled runtime verification should be implemented and
owned by the respective runtime repositories. The public protocol repository
may then publish only a redacted, deterministic evidence fixture after the
operator independently confirms that it contains no production endpoint,
tenant data, identity, credential, secret, payment state, or external-adopter
claim.

Until such evidence is published, C2AI2X Core v1 should be described as a
public contract derived from real architecture boundaries and validated by
offline conformance tests—not as a proven live interoperability network.
