const assert = require('node:assert/strict');
const test = require('node:test');
const { loadBundledModule } = require('../helpers/bundledModule.cjs');

const translations = {
  'pages.developerSettings.title': 'Developer settings',
  'pages.developerSettings.clearPlatformInfoWarning': 'This will clear current CRM platform information.',
  'pages.developerSettings.clearPlatformInfo': 'Clear platform info',
  'pages.developerSettings.checkInterfaceImplementations': 'Check interface implementations'
};

function t(key) {
  return translations[key] ?? key;
}

async function loadTranslatedComponent(entryPoint) {
  return loadBundledModule(entryPoint, {
    stubs: {
      '../../i18n': { t },
    },
  });
}

test('implemented interfaces page renders capability status list options', async () => {
  const implementedInterfacesPage = await loadBundledModule('src/components/developerSettingsPage/implementedInterfacesPage.js');

  const page = implementedInterfacesPage.getImplementedInterfacesPageRender({
    implementedInterfaces: {
      callLogger: true,
      messageLogger: false,
    },
  });

  assert.equal(page.id, 'implementedInterfacesPage');
  assert.equal(page.title, 'Implemented interfaces');
  assert.equal(page.schema.properties.implementedInterfaces.title, 'Implemented interfaces');
  assert.deepEqual(page.schema.properties.implementedInterfaces.oneOf, [
    { const: 'callLogger', title: 'callLogger', meta: 'Implemented' },
    { const: 'messageLogger', title: 'messageLogger', meta: 'Not implemented' },
  ]);
  assert.equal(page.uiSchema.implementedInterfaces['ui:field'], 'list');
  assert.deepEqual(page.formData, {});
});

test('developer settings page exposes admin-only user mapping reinitialization controls', async () => {
  const developerSettingsPage = await loadTranslatedComponent('src/components/developerSettingsPage/index.js');

  const userPage = developerSettingsPage.getDeveloperSettingsPageRender({ isAdmin: false });
  const adminPage = developerSettingsPage.getDeveloperSettingsPageRender({ isAdmin: true });

  assert.equal(userPage.id, 'developerSettingsPage');
  assert.equal(userPage.title, 'Developer settings');
  assert.equal(userPage.schema.properties.clearPlatformInfoWarning.description, 'This will clear current CRM platform information.');
  assert.equal(userPage.schema.properties.clearPlatformInfoButton.title, 'Clear platform info');
  assert.equal(userPage.schema.properties.openImplementedInterfacesPageButton.title, 'Check interface implementations');
  assert.equal(userPage.uiSchema.clearPlatformInfoWarning['ui:severity'], 'warning');
  assert.equal(userPage.schema.properties.reinitializeUserMappingButton, undefined);

  assert.equal(adminPage.schema.properties.reinitializeUserMappingButton.title, 'Re-initialize user mapping');
  assert.equal(adminPage.uiSchema.reinitializeUserMappingWarning['ui:severity'], 'warning');
  assert.equal(adminPage.uiSchema.reinitializeUserMappingButton['ui:field'], 'button');
});

test('error log record page renders each reporting step and disables next without a description', async () => {
  const errorLogRecordPage = await loadBundledModule('src/components/errorLogRecordPage.js');

  const blankStepOne = errorLogRecordPage.getErrorLogRecordPageRender({
    step: 1,
    email: 'ada@example.com',
    issueDescription: '',
  });
  const readyStepOne = errorLogRecordPage.getErrorLogRecordPageRender({
    step: 1,
    email: 'ada@example.com',
    issueDescription: 'Popup fails after login',
  });
  const stepTwo = errorLogRecordPage.getErrorLogRecordPageRender({ step: 2 });
  const stepThree = errorLogRecordPage.getErrorLogRecordPageRender({ step: 3 });

  assert.equal(blankStepOne.id, 'errorLogRecordPage');
  assert.equal(blankStepOne.title, 'Error Log Record');
  assert.equal(blankStepOne.schema.properties.userEmail.description, 'ada@example.com');
  assert.equal(blankStepOne.uiSchema.issueDescription['ui:widget'], 'textarea');
  assert.equal(blankStepOne.uiSchema.getErrorLogRecordPageNextStepButton['ui:disabled'], true);
  assert.deepEqual(blankStepOne.formData, {
    issueDescription: '',
    email: 'ada@example.com',
  });

  assert.equal(readyStepOne.uiSchema.getErrorLogRecordPageNextStepButton['ui:disabled'], false);
  assert.equal(readyStepOne.formData.issueDescription, 'Popup fails after login');
  assert.equal(stepTwo.title, 'Reproduce issue');
  assert.equal(stepTwo.schema.properties.errorLogRecordPageStartButton.title, 'Record session');
  assert.equal(stepTwo.uiSchema.errorLogRecordPageStartButton['ui:fullWidth'], true);
  assert.equal(stepThree.title, 'Recording in process');
  assert.match(stepThree.schema.properties.instructionTitle.description, /click "Stop"/);
});

test('log record submission page requires PII consent before enabling submit', async () => {
  const logRecordSubmissionPage = await loadBundledModule('src/components/logRecordSubmissionPage.js');

  const blockedPage = logRecordSubmissionPage.getLogRecordSubmissionPageRender({ piiConsent: false });
  const allowedPage = logRecordSubmissionPage.getLogRecordSubmissionPageRender({ piiConsent: true });
  const defaultPage = logRecordSubmissionPage.getLogRecordSubmissionPageRender({});

  assert.equal(blockedPage.id, 'logRecordSubmissionPage');
  assert.equal(blockedPage.schema.properties.piiConsent.type, 'boolean');
  assert.equal(blockedPage.schema.properties.logRecordSubmitButton.title, 'Send error report');
  assert.equal(blockedPage.uiSchema.piiConsent['ui:field'], 'checkbox');
  assert.equal(blockedPage.uiSchema.logRecordSubmitButton['ui:disabled'], true);
  assert.equal(allowedPage.uiSchema.logRecordSubmitButton['ui:disabled'], false);
  assert.deepEqual(defaultPage.formData, { piiConsent: false });
});

test('temporary log note page carries cached note and session id for one-time log waiting', async () => {
  const tempLogNotePage = await loadBundledModule('src/components/tempLogNotePage.js');

  const page = tempLogNotePage.getTempLogNotePageRender({
    cachedNote: 'Follow up next week',
    sessionId: 'call-session-1',
  });
  const emptyPage = tempLogNotePage.getTempLogNotePageRender({
    cachedNote: '',
    sessionId: 'call-session-2',
  });

  assert.equal(page.id, 'tempLogNotePage');
  assert.equal(page.title, 'Custom Note');
  assert.equal(page.schema.properties.note.title, 'Note');
  assert.equal(page.uiSchema.note['ui:widget'], 'textarea');
  assert.equal(page.schema.properties.saveTempNoteButton.title, 'Save');
  assert.deepEqual(page.formData, {
    note: 'Follow up next week',
    sessionId: 'call-session-1',
  });
  assert.deepEqual(emptyPage.formData, {
    note: '',
    sessionId: 'call-session-2',
  });
});