# App Connect Client Agent Rules

This project is `rc-unified-crm-extension-client/`, the browser extension client for App Connect.

## Test Enforcement

- For any source, service, core, event-handler, content-script, service-worker, build-tool, manifest, config, or test change, run the smallest relevant Vitest command before finishing. In PowerShell, use `npm.cmd` and `npx.cmd` when `npm.ps1` or `npx.ps1` is blocked.
- Focused tests should use:
  - `npm.cmd test -- <test paths>`
- For broad runtime, storage, auth, logging, service-worker, content-script, build-tool, or shared test harness changes, run full verification:
  - `npm.cmd test`
  - `npm.cmd run test:coverage`
  - `npm.cmd run build`
- For any change under `src/`, `public/`, `build.js`, `updateVersion.js`, or manifest files, run:
  - `npm.cmd run build`
- ESLint is currently a diagnostic command, not a clean gate, because baseline lint failures exist. When lint-sensitive files are touched, run and report:
  - `npx.cmd eslint src build.js updateVersion.js eslint.config.mjs`
- If no focused test exists for changed behavior, add or update one under `test/`, unless the behavior requires real browser-extension automation and is explicitly recorded as deferred.
- Mock Chrome APIs, widget frames, storage, IndexedDB/localStorage, Axios, and network boundaries. Do not depend on a real browser extension runtime unless the task explicitly asks for browser E2E work.
- Final summaries must list the exact verification commands run and any skipped commands with the reason.

## Known Verification Caveats

- The GitHub workflow currently builds/packages the extension; it does not prove the Vitest suite.
- Existing baseline lint errors should not be silently fixed during unrelated work, but new lint regressions in touched files should be avoided.
