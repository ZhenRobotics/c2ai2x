# Contributing

Keep changes focused on the published protocol assets and make the smallest
change that can express the intended protocol semantics. Before proposing a
change, run:

```bash
npm run validate
```

Do not commit credentials, private keys, tokens, production data, runtime
configuration, deployment settings, or operational logs. Do not add network
clients, platform API calls, SDK behavior, or third-party dependencies to this
asset snapshot.

Schema, example, conformance, or index changes require an accompanying review
of `integrity.json`; only update its digest when the asset change is intended.

