# RingCentral App Connect Client

[![Coverage](https://codecov.io/gh/ringcentral/rc-unified-crm-extension-client/branch/beta/graph/badge.svg)](https://codecov.io/gh/ringcentral/rc-unified-crm-extension-client?branch=beta)

It is to work with the server code: https://github.com/ringcentral/rc-unified-crm-extension

## Quick start

Assuming you have already setup your local server, let's then start setting up your client app. Here are the steps:

1. `npm i`
2. In `src`, there's a `manifest.json`. Change values in it to your server manifest url and version.
3. `npm run build`
4. The build will be in `dist` folder
5. To install it, go to chrome://extensions/ and toggle on "Developer mode" and click "Load unpacked"

## Test

Run unit and integration tests:

```bash
npm test
```

Run browser extension E2E smoke tests:

```bash
npm run test:e2e
```

The E2E command builds `dist/`, loads the unpacked extension in a temporary Chromium profile, and verifies local extension flows such as quick access, URL activation, click-to-dial, and call logging. Set `E2E_CHROME_PATH` or `E2E_BROWSER_CHANNEL` if the default local Chrome/Edge detection does not match your environment.

## Add your CRM

This client app is a Browser extension which has url matcher to control its accessibilities. To add your CRM urls:

1. Open `public/manifest.json`
2. Under `content_scripts.matches`, add your CRM's url
3. Under `web_accessible_resources/matches`, add your CRM's url

## Mixpanel raw IDs

Updated analytics emitters attach `rcAccountIdRaw` and `rcExtensionIdRaw` as strings, plus `analyticsSchemaVersion: 2` and `analyticsIdentityStatus`. Existing hashed `distinct_id`, account groups, request headers and `rcUserInfo` retain their meanings. Raw IDs come from current widget extension/account data and are held in a separate `analyticsIdentity` context.

Login establishes the context before CRM calls. Logout, account changes and identity failures clear the raw context and analytics request headers. Background error events restore it only if its legacy identities match the currently logged-in user. Missing/invalid raw values are omitted, not replaced with hashes.

Set `MIXPANEL_RAW_IDS_ENABLED=false` before `npm run build` to disable raw fields and the new `rc-analytics-account-id` / `rc-analytics-extension-id` request headers. Raw request headers are limited to the configured adapter server, not other Axios destinations. Rebuild and distribute the extension for the setting to take effect. Existing profile/event values are not removed by this switch.

Deploy the compatible App Connect Server before distributing the updated extension. Validate in Dev & QA, then Beta for at least 48 hours before Stable. See the Server repository's `docs/developers/mixpanel-raw-ids.md` for historical profile enrichment and rollout verification.
