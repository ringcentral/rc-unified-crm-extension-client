const assert = require('node:assert/strict');
const test = require('node:test');
const { loadBundledModule } = require('../helpers/bundledModule.cjs');

const translations = {
  'common.buttons.submit': 'Submit',
  'common.status.online': 'Online',
  'common.status.offline': 'Offline',
  'pages.feedback.title': 'Feedback',
  'pages.support.title': 'Support',
  'pages.support.documentation': 'Documentation',
  'pages.support.releaseNotes': 'Release notes',
  'pages.support.getSupport': 'Get support',
  'pages.support.writeReview': 'Write a review',
  'pages.support.communityForums': 'Community forums',
  'pages.support.serverStatus': 'Server status: {status}',
  'pages.support.rcAccountIdLabel': 'RingCentral account ID: {accountId}',
  'pages.support.versionLabel': 'Version: v{version}',
  'pages.support.sendErrorReport': 'Send error report',
  'pages.support.clearLogConflicts': 'Clear log conflicts',
  'pages.support.factoryResetWarning': 'Factory reset warning',
  'pages.support.factoryReset': 'Factory reset'
};

function t(key, params = {}) {
  const value = translations[key] ?? key;
  return value.replace(/\{(\w+)\}/g, (match, paramKey) => (
    params[paramKey] === undefined ? match : params[paramKey]
  ));
}

async function loadComponent(entryPoint) {
  return loadBundledModule(entryPoint, {
    stubs: {
      '../i18n': { t },
    },
  });
}

test('support page exposes service metadata and only includes report issue when the platform supports it', async () => {
  const supportPage = await loadComponent('src/components/supportPage.js');
  const manifest = {
    version: '1.7.35',
    platforms: {
      acme: {
        supportReportIssue: true,
      },
      basic: {
        supportReportIssue: false,
      },
    },
  };

  const page = supportPage.getSupportPageRender({
    manifest,
    platformName: 'acme',
    isOnline: false,
    rcAccountId: '',
  });
  const basicPage = supportPage.getSupportPageRender({
    manifest,
    platformName: 'basic',
    isOnline: true,
    rcAccountId: 'rc-account-1',
  });

  assert.equal(page.id, 'supportPage');
  assert.equal(page.title, 'Support');
  assert.equal(page.schema.properties.isServiceOnline.description, 'Server status: Offline');
  assert.equal(page.schema.properties.rcAccountId.description, 'RingCentral account ID: N/A');
  assert.equal(page.schema.properties.version.description, 'Version: v1.7.35');
  assert.equal(page.schema.properties.reportIssueButton.title, 'Send error report');
  assert.equal(page.uiSchema.clearLogConflictsButton['ui:color'], 'danger.b03');
  assert.equal(page.uiSchema.factoryResetWarning['ui:severity'], 'warning');

  assert.equal(basicPage.schema.properties.isServiceOnline.description, 'Server status: Online');
  assert.equal(basicPage.schema.properties.rcAccountId.description, 'RingCentral account ID: rc-account-1');
  assert.equal(basicPage.schema.properties.reportIssueButton, undefined);
});

test('feedback page converts connector feedback config into schema and hidden version form data', async () => {
  const feedbackPage = await loadComponent('src/components/feedbackPage.js');

  const page = feedbackPage.getFeedbackPageRender({
    version: '1.7.35',
    pageConfig: {
      elements: [
        { const: 'intro', type: 'string', title: 'Tell us what happened', bold: true },
        { const: 'summary', type: 'inputField', title: 'Summary', placeholder: 'Short summary', required: true },
        {
          const: 'severity',
          type: 'selection',
          title: 'Severity',
          required: true,
          selections: [
            { const: 'low', title: 'Low' },
            { const: 'high', title: 'High' },
          ],
        },
      ],
    },
  });

  assert.equal(page.id, 'feedbackPage');
  assert.equal(page.title, 'Feedback');
  assert.deepEqual(page.schema.required, ['summary', 'severity']);
  assert.deepEqual(page.schema.properties.intro, {
    type: 'string',
    description: 'Tell us what happened',
  });
  assert.equal(page.uiSchema.intro['ui:variant'], 'body2');
  assert.equal(page.schema.properties.summary.title, 'Summary');
  assert.equal(page.uiSchema.summary['ui:widget'], 'textarea');
  assert.equal(page.uiSchema.summary['ui:placeholder'], 'Short summary');
  assert.deepEqual(page.schema.properties.severity.oneOf, [
    { const: 'low', title: 'Low' },
    { const: 'high', title: 'High' },
  ]);
  assert.equal(page.uiSchema.submitButtonOptions.submitText, 'Submit');
  assert.equal(page.uiSchema.version['ui:widget'], 'hidden');
  assert.deepEqual(page.formData, { version: '1.7.35' });
});

test('managed OAuth missing page renders a non-submit warning page', async () => {
  const managedOAuthMissingPage = await loadBundledModule('src/components/managedOAuthMissingPage.js');

  const page = managedOAuthMissingPage.getManagedOAuthMissingPageRender();

  assert.equal(page.id, 'managedOAuthMissingPage');
  assert.equal(page.title, 'Authorization information is not provided');
  assert.equal(page.schema.properties.message.description, 'Authorization information is not provided. Please contact the admin user.');
  assert.equal(page.uiSchema.submitButtonOptions.norender, true);
  assert.equal(page.uiSchema.message['ui:field'], 'admonition');
  assert.equal(page.uiSchema.message['ui:severity'], 'warning');
  assert.deepEqual(page.formData, {});
});

test('managed OAuth setup page renders required credential fields and pending values', async () => {
  const managedOAuthSetupPage = await loadBundledModule('src/components/managedOAuthSetupPage.js');

  const page = managedOAuthSetupPage.getManagedOAuthSetupPageRender({
    platform: {
      auth: {
        oauth: {
          adminManaged: {
            setupNotes: 'Use the CRM OAuth app assigned to this account.',
          },
        },
      },
    },
    pendingValues: {
      clientId: 'client-1',
      redirectUri: 'https://crm.example.com/oauth/callback',
    },
  });

  assert.equal(page.id, 'managedOAuthSetupPage');
  assert.equal(page.title, 'Admin-managed OAuth credentials');
  assert.deepEqual(page.schema.required, [
    'clientId',
    'clientSecret',
    'accessTokenUri',
    'authorizationUri',
    'redirectUri',
    'hostname',
  ]);
  assert.equal(page.schema.properties.setupNotes.description, 'Use the CRM OAuth app assigned to this account.');
  assert.equal(page.schema.properties.clientSecret.title, 'Client Secret');
  assert.equal(page.uiSchema.submitButtonOptions.submitText, 'Save and connect');
  assert.equal(page.uiSchema.clientSecret['ui:widget'], 'password');
  assert.equal(page.formData.clientId, 'client-1');
  assert.equal(page.formData.redirectUri, 'https://crm.example.com/oauth/callback');
});