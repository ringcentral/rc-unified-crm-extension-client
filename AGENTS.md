# App Connect Client Agent Rules

This project is `rc-unified-crm-extension-client/`, the browser extension client for App Connect.

## Test Enforcement

- For any source, service, core, event-handler, content-script, service-worker, build-tool, manifest, config, or test change, run the smallest relevant Vitest command before finishing. In PowerShell, use `npm.cmd` and `npx.cmd` when `npm.ps1` or `npx.ps1` is blocked.
- Focused tests should use:
  - `npm.cmd test -- <test paths>`
- For broad runtime, storage, auth, logging, service-worker, content-script, build-tool, or shared test harness changes, run full verification:
  - `npm.cmd run lint`
  - `npm.cmd run typecheck`
  - `npm.cmd run typecheck:test`
  - `npm.cmd run typecheck:e2e`
  - `npm.cmd test`
  - `npm.cmd run test:coverage`
  - `npm.cmd run build`
- For any change under `src/`, `public/`, `build.ts`, `updateVersion.ts`, or manifest files, run:
  - `npm.cmd run build`
- ESLint is a required clean gate. Run `npm.cmd run lint` for lint-sensitive changes.
- For browser E2E or fixture changes, run both `npm.cmd run typecheck:e2e` and `npm.cmd run test:e2e`.
- If no focused test exists for changed behavior, add or update one under `test/`, unless the behavior requires real browser-extension automation and is explicitly recorded as deferred.
- Mock Chrome APIs, widget frames, storage, IndexedDB/localStorage, Axios, and network boundaries. Do not depend on a real browser extension runtime unless the task explicitly asks for browser E2E work.
- Final summaries must list the exact verification commands run and any skipped commands with the reason.

## CI and Release Gates

- Pull-request CI and release verification require lint, source/test/E2E type checks, coverage, and Playwright E2E before packaging.
- Commit the root `package-lock.json` with dependency changes. Use `npm.cmd ci` for clean installs and CI; use `npm.cmd install` only when intentionally updating dependencies and review the resulting lockfile.
- Preserve `.npmrc`'s `omit-lockfile-registry-resolved=true` so the lock pins versions and integrity without hardcoding a registry. Resolve and verify updates against the configured Nexus registry, which may lag npmjs; do not bypass it or lower security minimums to work around unavailable packages.
