# RingCentral App Connect Client

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
