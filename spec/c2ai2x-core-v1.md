# C2AI2X Core v1

## Status and scope

This document defines the C2AI2X Core v1 interchange contract. It specifies
portable messages for carrying a demand, an optional authorization context,
and lifecycle outcomes between independently implemented adapters.

It is not a platform API, authentication mechanism, execution runtime,
robot-control protocol, SDK, or service-level agreement.

## Terms

- **Producer** creates a request message.
- **Provider** accepts a request and produces lifecycle outcomes.
- **Demand** is the work or consultation context, represented by the Core
  `Demand` object.
- **AuthorizationGrant** is optional protocol context; it does not replace
  transport authentication or a platform admission decision.
- **Message** is a wire envelope with a stable identity and trace.

## Wire envelope

Every message has `standard` equal to `c2ai2x-core`, `version` equal to `v1`,
and a globally unique `message_id`. `trace_id` correlates related messages.
For request messages, `idempotency_key` identifies equivalent submissions from
the same producer; a provider MUST return a semantically equivalent accepted
or completed outcome for a repeated key within its own retention policy.
Every provider response and terminal event MUST set
`in_reply_to_request_id` to the `message_id` of the request it answers.

The `kind` determines the payload shape:

| Kind | Direction | Payload |
| --- | --- | --- |
| `request` | producer → provider | complete Core Demand and optional AuthorizationGrant |
| `accepted` | provider → producer | workflow reference for asynchronous work |
| `completed` (synchronous) | provider → producer | direct result summary; no workflow reference |
| `completed` (asynchronous) | provider → producer | workflow-linked terminal result summary |
| `failed` | provider → producer | workflow-linked terminal error |
| `cancelled` | provider → producer | workflow-linked terminal cancellation reason |

When a request embeds an `AuthorizationGrant`, its `demand_id` MUST equal
`Demand.identity.demand_id` in that same request. This is a cross-field
conformance check and cannot be guaranteed by validating either individual
Core message JSON Schema alone.

## Lifecycle

1. A producer sends one `request` message.
2. A provider returns either a synchronous `completed` response, which has no
   `workflow_id`, or an `accepted` message.
3. An accepted workflow later emits exactly one terminal `completed`,
   `failed`, or `cancelled` event with the same `trace_id` and the
   `workflow_id` returned by `accepted`. A cancelled event MUST include a
   non-empty cancellation reason.

Providers MUST NOT emit a terminal event before `accepted` for the same
asynchronous workflow. A synchronous completed response MUST NOT be followed
by a terminal event for that request. Consumers MUST treat duplicate terminal
messages with the same `message_id` as duplicates.

## Version and compatibility

The published Core v1 contract is frozen. Consumers MUST reject a different
`standard`, a different `version`, or fields not defined by the published v1
schemas. Any change, including an additive field, requires publication of a
new contract version; this document makes no forward-compatibility claim for
unpublished fields.

Within Core objects, `Demand.identity.protocol_version` and
`Envelope.protocol_version` are each the literal `v1`; consumers MUST reject
any other value, including `v2`.

## Security boundaries

The protocol does not define credential fields. Producers MUST NOT transmit
bearer tokens, credentials, platform secrets, tenant billing state, production
configuration, or robot-control commands in any message or payload. Transport
authentication, authorization admission, quota, sandboxing, and execution are
outside this specification.

## Conformance

An implementation conforms to this document when it validates the published
wire schemas, preserves `message_id`, `trace_id`, and request-reply bindings,
enforces the lifecycle rules above, and passes the published fixtures. See `wire/` and
`conformance/wire-manifest.json`.
