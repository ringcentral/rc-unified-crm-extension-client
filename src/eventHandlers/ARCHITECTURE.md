# Event Handlers Architecture

All widget events enter through `src/popup.js` via `window.addEventListener('message', ...)`.
The handler dispatches on `data.type`, routing each event to a dedicated file or sub-router.

---

## Top-level notify handlers (`src/eventHandlers/*.js`)

Routed by `data.type` in `popup.js`.

| `data.type` | File | What it does |
|---|---|---|
| `rc-login-status-notify` | `rc-login-status-notify.js` | CRM auth check, auto-login, tab registration, settings refresh, analytics identify |
| `rc-active-call-notify` | `rc-active-call-notify.js` | Call lifecycle (ringing → connected → ended), screen pop, log page auto-popup |
| `rc-route-changed-notify` | `rc-route-changed-notify.js` | Navigation analytics, calldown tab refresh, throttled settings refresh |
| `rc-dialer-status-notify` | `rc-dialer-status-notify.js` | On dialer ready: replay cached Click-to-Dial/SMS/Schedule requests |
| `rc-telephony-session-notify` | `rc-telephony-session-notify.js` | Recording detection, attended transfer hold state |
| `rc-webphone-connection-status-notify` | `rc-webphone-connection-status-notify.js` | On connected: auth check + register feedback button |
| `rc-region-settings-notify` | `rc-region-settings-notify.js` | Store region/country, re-register service manifest after locale change |
| `rc-adapter-pushAdapterState` | `rc-adapter-pushAdapterState.js` | Manifest refresh, matchAllNumbers config, service re-registration |
| `rc-callLogger-auto-log-notify` | `rc-callLogger-auto-log-notify.js` | Start retro auto-log polling interval when auto-log toggled on |
| `rc-messageLogger-auto-log-notify` | `rc-messageLogger-auto-log-notify.js` | Analytics tracking for message-log toggle |
| `rc-analytics-track` | `rc-analytics-track.js` | Route RC widget analytics events (SMS sent, meeting, WebRTC call ended) |
| `rc-call-init-notify` | `rc-call-init-notify.js` | Analytics: placed call |
| `rc-call-start-notify` | `rc-call-start-notify.js` | Analytics: answered call |
| `rc-ringout-call-notify` | `rc-ringout-call-notify.js` | Analytics: RingOut connected |
| `rc-login-popup-notify` | `rc-login-popup-notify.js` | Open RC OAuth window via service worker |
| `rc-calling-settings-notify` | `rc-calling-settings-notify.js` | Stub (logs only) |
| `rc-adapter-side-drawer-open-notify` | `rc-adapter-side-drawer-open-notify.js` | Forward side-drawer state to service worker |
| `rc-adapter-ai-assistant-settings-notify` | `rc-adapter-ai-assistant-settings-notify.js` | Persist AI assistant settings |
| `rc-adapter-phone-number-format-settings-notify` | `rc-adapter-phone-number-format-settings-notify.js` | Persist phone number format settings |
| `rc-post-message-request` | `rc-post-message-request/index.js` | **Sub-router** — see section below |

---

## `rc-post-message-request` sub-router (`rc-post-message-request/index.js`)

Routed by `data.path`.

| `data.path` | File | What it does |
|---|---|---|
| `/authorize` | `authorize.js` | CRM connect / disconnect |
| `/platform-selection` | _(inline)_ | Open platform selection page |
| `/contacts/match` | `contacts/match.js` | Bulk contact lookup by phone number |
| `/contacts/view` | `contacts/view.js` | Open CRM contact page |
| `/callLogger` | `callLogger/index.js` | Call log main flow (auto/manual/sync/view) |
| `/callLogger/inputChanged` | `callLogger/inputChanged/index.js` | Live form update for call log |
| `/callLogger/match` | `callLogger/match/index.js` | Call log match check |
| `/messageLogger` | `messageLogger/index.js` | Message log main flow (auto/manual/view) |
| `/messageLogger/inputChanged` | `messageLogger/inputChanged/index.js` | Live form update for message log |
| `/messageLogger/match` | `messageLogger/match/index.js` | Message log match check |
| `/settings` | `settings.js` | Settings page save |
| `/custom-button-click` | `custom-button-click/index.js` | **Sub-router** — see section below |
| `/customizedPage/inputChanged` | `customizedPage/inputChanged/index.js` | **Sub-router** — see section below |

---

## `/custom-button-click` sub-router (`custom-button-click/index.js`)

Routed by `data.body.button.id` (parsed as `{actionId}-{itemId}-action`).

### `auth/` — Authentication & platform setup

| Button ID | File | What it does |
|---|---|---|
| `authPage` | `auth/authPage.js` | API key login |
| `hostnameInputPage` | `auth/hostnameInputPage.js` | Save hostname/env URL, re-register manifest |
| `selectPlatform` | `auth/selectPlatform.js` | Save selected platform from list |
| `factoryResetButton` | `auth/factoryResetButton.js` | Full reset: de-auth, clear platform, logout |
| `insightlyGetApiKey` | `auth/insightlyGetApiKey.js` | Insightly-specific: retrieve API key |

### `calldown/` — Scheduling & call-down list

| Button ID | File | What it does |
|---|---|---|
| `callLater` | `calldown/callLater.js` | Schedule callback from call history |
| `callLaterInMessage` | `calldown/callLaterInMessage.js` | Schedule callback from messages |
| `callLaterInContact` | `calldown/callLaterInContact.js` | Schedule callback from contact page |
| `scheduleSubmit` | `calldown/scheduleSubmit.js` | Submit schedule/callback form |
| `calldownActionCall` | `calldown/calldownActionCall.js` | Call a call-down item |
| `calldownActionOpen` | `calldown/calldownActionOpen.js` | Open CRM contact for call-down item |
| `calldownActionText` | `calldown/calldownActionText.js` | SMS a call-down item |
| `calldownActionEdit` | `calldown/calldownActionEdit.js` | Edit a call-down item |
| `calldownActionComplete` | `calldown/calldownActionComplete.js` | Mark call-down item complete |
| `calldownActionRemove` | `calldown/calldownActionRemove.js` | Delete a call-down item |
| `saveTempNoteButton` | `calldown/saveTempNoteButton.js` | Save temp call note while log data prepares |

### `plugins/` — Plugin management

| Button ID | File | What it does |
|---|---|---|
| `openInstalledPluginListPage` | `plugins/installedPluginListPage.js` | Fetch user settings, show installed plugins list |
| `selectPlugin` | `plugins/selectPlugin.js` | Open plugin configure page (user or admin) |
| `pluginConfigurePage` (submit) | `plugins/pluginConfigurePageSubmit.js` | Save plugin user configuration |
| `pluginDetailsSettingPage` (submit) | `plugins/pluginDetailsSettingPage.js` | Save plugin admin configuration |
| _(non-submit, has pluginId, user)_ | `plugins/pluginConfigButtons.js` | Handle arbitrary user-side plugin button clicks |
| _(non-submit, has pluginId, admin)_ | `plugins/pluginAdminConfigButtons.js` | Handle arbitrary admin-side plugin button clicks |

### `adminSettings/` — Admin settings forms

| Button ID | File | What it does |
|---|---|---|
| `callAndSMSLoggingSettingPage`, `contactSettingPage`, `callLogDetailsSettingPage`, `autoLogPreferenceSettingPage`, `advancedFeaturesSettingPage`, `customSettingsPage`, `customizeTabsSettingPage`, `widgetSettingsPage`, `notificationLevelSettingPage`, `phoneNumberFormatPage`, `clickToDialEmbedPage` | `adminSettings/adminSettingsFormSubmit.js` | Generic admin settings save for all settings form pages |
| `saveServerSideLoggingButton` | `adminSettings/saveServerSideLogging.js` | Save server-side logging config |
| `doNotLogNumbersSubmitButton` | `adminSettings/doNotLogNumbersSubmit.js` | Save the "do not log" phone number list |

### `userMapping/` — User mapping management

| Button ID | File | What it does |
|---|---|---|
| `editUserMappingPage` | `userMapping/editUserMappingPage.js` | Open user mapping edit form |
| `usermappingEdit` | `userMapping/usermappingEdit.js` | Edit a user mapping entry |
| `usermappingRemove` | `userMapping/usermappingRemove.js` | Remove a user mapping entry |
| `reinitializeUserMappingButton` | `userMapping/reinitializeUserMappingButton.js` | Re-initialize user mapping data |

### `googleSheets/` — Google Sheets integration

| Button ID | File | What it does |
|---|---|---|
| `googleSheetsConfig` | `googleSheets/googleSheetsConfig.js` | Open Google Sheets config page |
| `newSheetButton` | `googleSheets/newSheetButton.js` | Create a new sheet (user) |
| `selectExistingSheetButton` | `googleSheets/selectExistingSheetButton.js` | Show existing sheet selection (user) |
| `userGoogleSheetSelected` | `googleSheets/userGoogleSheetSelected.js` | Save user's selected sheet |
| `removeSheetButton` | `googleSheets/removeSheetButton.js` | Remove user's linked sheet |
| `adminNewSheetButton` | `googleSheets/adminNewSheetButton.js` | Create a new sheet (admin) |
| `adminSelectExistingSheetButton` | `googleSheets/adminSelectExistingSheetButton.js` | Show existing sheet selection (admin) |
| `adminGoogleSheetSelected` | `googleSheets/adminGoogleSheetSelected.js` | Save admin's selected sheet |
| `adminRemoveSheetButton` | `googleSheets/adminRemoveSheetButton.js` | Remove admin's linked sheet |

### `contactSearch/` — Custom contact search

| Button ID | File | What it does |
|---|---|---|
| `contactSearchAdapterButtonCallLog` | `contactSearch/contactSearchAdapterButtonCallLog.js` | Select contact from search for call log |
| `contactSearchAdapterButtonMessageLog` | `contactSearch/contactSearchAdapterButtonMessageLog.js` | Select contact from search for message log |

### `navigation/` — UI navigation & informational pages

| Button ID | File | What it does |
|---|---|---|
| `openAboutPage` | `navigation/openAboutPage.js` | Open the About page |
| `openDeveloperSettingsPage` | `navigation/openDeveloperSettingsPage.js` | Open developer settings |
| `openImplementedInterfacesPageButton` | `navigation/openImplementedInterfacesPageButton.js` | Open implemented interfaces info page |
| `feedbackPage` | `navigation/feedbackPage.js` | Open feedback page |
| `documentation` | `navigation/documentation.js` | Open documentation URL |
| `customizedBanner` _(type)_ | `navigation/customizedBanner.js` | Handle customized banner button clicks |
| `openSupportPage` | _(inline in index.js)_ | Open support page via service worker |
| `openCommunityPageButton` | _(inline in index.js)_ | Open community page URL |
| `releaseNotes` | _(inline in index.js)_ | Open platform release notes URL |
| `getSupport` | _(inline in index.js)_ | Open platform support URL |
| `writeReview` | _(inline in index.js)_ | Open platform review URL |
| `clearPlatformInfoButton` | _(inline in index.js)_ | Clear platform info from storage |
| `refreshLicense` | _(inline in index.js)_ | Refresh license status |

### `errorLogging/` — Error reporting & log recording

| Button ID | File | What it does |
|---|---|---|
| `reportIssueButton` | `errorLogging/reportIssueButton.js` | Open the log recording flow |
| `errorLogRecordPageStartButton` | `errorLogging/errorLogRecordPageStart.js` | Start log recording |
| `getErrorLogRecordPageNextStepButton` | `errorLogging/errorLogRecordPageNextStep.js` | Advance to next step in error log flow |
| `logRecordSubmitButton` | `errorLogging/logRecordSubmit.js` | Stop recording and upload captured logs |

---

## `/customizedPage/inputChanged` sub-router (`customizedPage/inputChanged/index.js`)

This router has two separate dispatch passes on each event:

1. **`pages/`** — routed by `data.body.page.id` — handlers for specific CRM extension pages
2. **`sections/`** — routed by `data.body.formData.section` — handlers that switch between admin settings sections

### `pages/` — Page-specific input handlers

| `page.id` | File | What it does |
|---|---|---|
| `c2dSchedulePage` | `pages/c2dSchedulePage.js` | Update schedule/callback page |
| `editUserMappingPage` | `pages/editUserMappingPage.js` | Update user mapping edit form |
| `userMappingPage` | `pages/userMappingPage.js` | Update user mapping list page |
| `hostnameInputPage` | `pages/hostnameInputPage.js` | Update hostname input page |
| `platformSelectionPage` | `pages/platformSelectionPage.js` | Update platform selection page |
| `getMultiContactPopPromptPage` | `pages/getMultiContactPopPromptPage.js` | Update multiple-contact prompt page |
| `calldownPage` | `pages/calldownPage.js` | Handle call-down list search/filter (debounced) |
| `googleSheetsPage` | `pages/googleSheetsPage.js` | Update Google Sheets user config page |
| `contactSearchResultCallLog` | `pages/contactSearchResultCallLog.js` | Handle contact search result selection for call log |
| `contactSearchResultMessageLog` | `pages/contactSearchResultMessageLog.js` | Handle contact search result selection for message log |
| `reportPage` | `pages/reportPage.js` | Update report page (date range, etc.) |
| `unloggedCallPage` | `pages/unloggedCallPage.js` | Open call log page for a selected unlogged call |
| `developerSettingsPage` | `pages/developerSettingsPage.js` | Update developer settings page |
| `errorLogRecordPage` | `pages/getErrorLogRecordPage.js` | Update error log recording page |
| `logRecordSubmissionPage` | `pages/logRecordSubmissionPage.js` | Update log submission page |
| `adminGoogleSheetsPage` | `pages/adminGoogleSheetsPage.js` | Update admin Google Sheets config page |
| `pluginAdminSettingsPage` | `pages/pluginAdminSettingsPage.js` | Re-render plugin admin settings when section/plugin selected |

### `sections/` — Admin settings section-switch handlers

| `formData.section` | File | What it does |
|---|---|---|
| `generalSettings` | `sections/generalSettings.js` | Navigate to admin general settings sub-page |
| `managedSettings` | `sections/managedSettings.js` | Navigate to admin managed settings sub-page |
| `plugins` (page: `adminPage`) | `sections/installedPlugins.js` | Show installed plugins list |
| `plugins` (page: `managedSettings`) | `sections/pluginsAdminConfig.js` | Show plugins admin config page |
| `pluginMarket` | _(shared)_ `../../pluginMarketListPage.js` | Render plugin marketplace list |
| `appearance` | `sections/appearance.js` | Render appearance settings section |
| `customizeTabs` | `sections/customizeTabs.js` | Render customize tabs settings section |
| `widgetSettings` | `sections/widgetSettings.js` | Render widget settings section |
| `notificationLevel` | `sections/notificationLevel.js` | Render notification level settings section |
| `phoneNumberFormat` | `sections/phoneNumberFormat.js` | Render phone number format settings section |
| `clickToDialEmbed` | `sections/clickToDialEmbed.js` | Render click-to-dial embed settings section |
| `callAndSMSLogging` | `sections/callAndSMSLogging.js` | Render call & SMS logging settings section |
| `serverSideLoggingSetting` | `sections/serverSideLoggingSetting.js` | Render server-side logging settings section |
| `contactSetting` | `sections/contactSetting.js` | Render contact settings section |
| `advancedFeaturesSetting` | `sections/advancedFeaturesSetting.js` | Render advanced features settings section |
| `customSettings` | `sections/customSettings.js` | Render custom settings section |
| `callLogDetailsSetting` | `sections/callLogDetailsSetting.js` | Render call log details settings section |
| `autoLogPreferences` | `sections/autoLogPreferences.js` | Render auto-log preferences settings section |
| `userMapping` | `sections/userMapping.js` | Render user mapping settings section |
| `googleSheetsAdminConfig` | `sections/googleSheetsAdminConfig.js` | Render admin Google Sheets config section |
