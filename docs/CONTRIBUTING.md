# Contributing to Accountability Layer

Thank you for contributing. The following guidelines keep reviews predictable and CI green.

## Code of conduct

Be respectful, assume good intent, and keep discussion focused on the work. Harassment and exclusionary behavior are not acceptable.

## Repository layout

This is an **npm workspaces** monorepo:

| Workspace               | Path        | Role                                      |
| ----------------------- | ----------- | ----------------------------------------- |
| `accountabilitylayer`   | root        | Shared scripts (format), Prettier         |
| `accountability-backend`| `backend/`  | Express API, TypeScript build to `dist/`  |
| `accountability-frontend` | `frontend/` | Vite + React 19 UI                        |
| `accountability-bench`  | `bench/`    | Load scripts (autocannon, k6 helpers)     |

Install once from the **repository root** (Node **22+**):

```bash
git clone <your-fork-or-upstream-url>
cd accountabilitylayer
npm ci
```

Use `npm install` locally when you change dependencies and need the lockfile updated (then commit `package-lock.json`).

## How to contribute

1. **Fork** the repository (if you do not have write access).

2. **Clone** your fork and add `upstream` if you plan to sync often:

   ```bash
   git clone https://github.com/<you>/accountabilitylayer.git
   cd accountabilitylayer
   ```

3. **Branch** from `main` or `develop` (match what your PR targets):

   ```bash
   git checkout -b feature/short-description
   ```

4. **Implement** changes with tests where it makes sense. Match existing style; run format and lint before pushing.

5. **Commit** with clear messages (imperative mood, scoped when helpful):

   ```bash
   git commit -m "Add validation for log bulk payload"
   ```

6. **Push** and open a **pull request** describing behavior, risk, and how you tested.

   ```bash
   git push origin feature/short-description
   ```

## Checks to run locally

From the repo root:

```bash
npm run format:check
npm run lint --workspaces --if-present
npm run build -w accountability-backend
npm test -w accountability-backend          # MongoDB reachable for integration paths
npm run test -w accountability-frontend
```

OpenAPI is linted in CI with Redocly:

```bash
npx --yes @redocly/cli@1 lint docs/api-spec.yaml
```

End-to-end tests need the stack or API + UI running; see [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md).

## Branching

- **main**: stable default; protect with required checks.
- **develop**: optional integration branch when the team uses it.
- **feature/**, **fix/**: short-lived branches for PRs.

## Pull requests

- Describe what changed and why; link issues when applicable.
- Keep unrelated refactors out of the same PR when possible.
- Ensure CI passes (lint, tests, OpenAPI, audits as configured).
- Breaking changes need explicit discussion in the PR description.

Thank you for helping improve the Accountability Layer.
