# Reference adapter and mock provider

`adapter.mjs` converts a local widget-shaped submission to a C2AI2X wire
request. `mock-provider.mjs` deterministically returns an accepted event and a
terminal completed event. Together they demonstrate message identity, trace
propagation and lifecycle ordering without a network, credential, platform
runtime, or production provider.

Run the demonstration test with:

```bash
node reference/adapter-mock-provider.test.mjs
```
