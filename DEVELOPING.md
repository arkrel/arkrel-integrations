# Developing n8n-nodes-arkrel

This repository is the source of the `n8n-nodes-arkrel` package on npm. It follows the layout of n8n's official node starter (`@n8n/node-cli`):

- `credentials/ArkrelApi.credentials.ts`: the Arkrel API key credential (Bearer auth, tested against `GET /v1/usage`).
- `nodes/Arkrel/`: the action node (Upload Document, Get Result).
- `nodes/ArkrelTrigger/`: the webhook trigger. `GenericFunctions.ts` holds the signature check, unit tested in `test/`.
- `mcp/`: configs for Arkrel's MCP server. Not part of the npm package.

## Commands

```sh
npm ci
npm run build   # n8n-node build: TypeScript plus icons into dist/
npm run lint    # n8n-node lint: the same rules n8n's verification scanner applies
npm test        # webhook signature tests
```

To try the node in a local n8n: `npm run build`, then `npm link` here and `npm link n8n-nodes-arkrel` in `~/.n8n/custom`, and restart n8n.

## Releasing

Releases are published by GitHub Actions, never from a laptop, so every version carries npm provenance:

1. Bump `version` in `package.json` and commit.
2. Tag the commit `n8n-vX.Y.Z` and push the tag.
3. `.github/workflows/publish-n8n.yml` builds, tests and runs `npm publish` through npm Trusted Publishing (no token).
4. Check the result with `npx @n8n/scan-community-package n8n-nodes-arkrel`.
