# RingCentral App Connect Client

It is to work with the server code: https://github.com/ringcentral/rc-unified-crm-extension

## Quick start

Assuming you have already setup your local server, let's then start setting up your client app. Here are the steps:

1. `npm i`
2. In `src`, there's a `manifest.json`. Change values in it to your server manifest url and version.
3. `npm run build`
4. The build will be in `dist` folder
5. To install it, go to chrome://extensions/ and toggle on "Developer mode" and click "Load unpacked"


## Testing

Run the default client unit and contract tests:

```bash
npm test
```

Run the browser smoke tests after building the unpacked extension:

```bash
npm run build
npm run test:e2e
```

The default GitHub Actions build workflow runs `npm test` before `npm run build` on pull requests, manual runs, release branch pushes, and tag builds. Browser E2E smoke tests are available from the manual `Browser E2E Smoke` workflow.

The E2E smoke suite requires Chrome or Microsoft Edge. Set `CHROME_PATH` if neither browser is installed in the default Windows location. The detailed coverage plan is in `docs/testing-strategy.zh.md`.

## Add your CRM

This client app is a Browser extension which has url matcher to control its accessibilities. To add your CRM urls:

1. Open `public/manifest.json`
2. Under `content_scripts.matches`, add your CRM's url
3. Under `web_accessible_resources/matches`, add your CRM's url