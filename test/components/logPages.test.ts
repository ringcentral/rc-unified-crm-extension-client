import logCore from '../../src/core/log.ts';
import { loadModule } from '../helpers/loadModule';

vi.mock('../../src/core/log.ts', () => ({
  default: {
    getConflictContentFromUnresolvedLog: vi.fn(),
  },
}));

async function loadLogPageUtils() {
  vi.resetModules();
  return loadModule('../../src/components/logPageUtils.ts');
}

async function loadLogPage() {
  vi.resetModules();
  return loadModule('../../src/components/logPage.ts');
}

async function loadGroupLogPage() {
  vi.resetModules();
  return loadModule('../../src/components/groupLogPage.ts');
}

function manifest() {
  return {
    platforms: {
      salesforce: {
        displayName: 'Salesforce',
        contactTypes: [
          { value: 'Lead', display: 'Lead' },
          { value: 'Contact', display: 'Contact' },
        ],
        page: {
          callLog: {
            additionalFields: [
              { const: 'disposition', title: 'Disposition', type: 'selection', required: true, contactDependent: true },
              { const: 'priority', title: 'Priority', type: 'selection', includeNoneOption: false },
              { const: 'followUp', title: 'Follow up', type: 'checkbox', required: true, defaultValue: true },
              { const: 'caseId', title: 'Case ID', type: 'inputField', pattern: '^CASE-[0-9]+$', required: true },
              { const: 'callWarning', title: 'Warning', type: 'warning', description: 'Check details' },
              { const: 'hiddenForLead', title: 'Hidden', type: 'inputField', showIfContactType: ['Contact'] },
            ],
          },
          messageLog: {
            additionalFields: [
              { const: 'messageType', title: 'Message Type', type: 'selection', required: true, contactDependent: true },
              { const: 'messageFlag', title: 'Message Flag', type: 'checkbox', defaultValue: false },
            ],
          },
          newContact: {
            additionalFields: [
              { const: 'newCategory', title: 'New Category', type: 'selection', contactTypeDependent: true, required: true },
              { const: 'newOnly', title: 'New Only', type: 'inputField', showIfContactType: ['Lead'] },
            ],
          },
        },
      },
    },
  };
}

function existingContact(overrides = {}) {
  return {
    id: 'contact-1',
    name: 'Jane Smith',
    type: 'Lead',
    toNumberEntity: true,
    additionalInfo: {
      disposition: [
        { const: 'demo', title: 'Demo' },
        { const: 'support', title: 'Support' },
      ],
      priority: [
        { const: 'high', title: 'High' },
      ],
      messageType: [
        { const: 'sms', title: 'SMS' },
      ],
    },
    ...overrides,
  };
}

function newContact() {
  return {
    id: 'new-contact',
    name: 'New Contact',
    isNewContact: true,
    defaultContactType: 'Lead',
    additionalInfo: {
      Lead: {
        newCategory: [
          { const: 'prospect', title: 'Prospect' },
        ],
      },
      newCategory: [
        { const: 'default-new', title: 'Default New' },
      ],
      priority: [
        { const: 'medium', title: 'Medium' },
      ],
    },
  };
}

function richMessageManifest() {
  const next: any = manifest();
  next.platforms.salesforce.page.messageLog.additionalFields = [
    { const: 'messageType', title: 'Message Type', type: 'selection', required: true, contactDependent: true },
    { const: 'missingSelection', title: 'Missing Selection', type: 'selection', contactDependent: true },
    { const: 'messageFlag', title: 'Message Flag', type: 'checkbox', required: true, defaultValue: true },
    { const: 'missingFlag', title: 'Missing Flag', type: 'checkbox', contactDependent: true },
    { const: 'messageMemo', title: 'Message Memo', type: 'inputField', pattern: '^OK-[0-9]+$', required: true },
    { const: 'skipMemo', title: 'Skip Memo', type: 'inputField', contactDependent: true, defaultValue: 'skip' },
    { const: 'messageWarning', title: 'Message Warning', type: 'warning', description: 'Check message details' },
  ];
  next.platforms.salesforce.page.newContact.additionalFields = [
    { const: 'newCategory', title: 'New Category', type: 'selection', contactTypeDependent: true, required: true },
    { const: 'newOnly', title: 'New Only', type: 'inputField', showIfContactType: ['Lead'] },
  ];
  return next;
}

async function createAdvancedCallLogPage() {
  const logPage = await loadLogPage();
  const contactWithContactTypeFields = {
    ...newContact(),
    additionalInfo: {
      ...newContact().additionalInfo,
      Contact: {
        newCategory: [
          { const: 'customer', title: 'Customer' },
        ],
      },
    },
  };
  const basePage = logPage.getLogPageRender({
    id: 'session-advanced',
    manifest: manifest(),
    logType: 'Call',
    triggerType: 'createLog',
    platformName: 'salesforce',
    direction: 'Outbound',
    contactInfo: [contactWithContactTypeFields, existingContact()],
    logInfo: {},
    contactPhoneNumber: '+16505550100',
    useContactSearch: true,
  });

  return {
    logPage,
    basePage,
  };
}

function updateCallLogPage(logPage, page, keys, formData) {
  return logPage.getUpdatedLogPageRender({
    manifest: manifest(),
    logType: 'Call',
    platformName: 'salesforce',
    updateData: {
      keys,
      page,
      formData: {
        ...page.formData,
        ...formData,
      },
    },
  });
}

describe('logPageUtils', () => {
  it('builds contact options, contact warnings, new-contact widgets, and additional field schema', async () => {
    const utils = await loadLogPageUtils();
    const contacts = [
      existingContact(),
      newContact(),
    ];

    expect(utils.buildContactOptions(contacts, true)).toMatchObject([
      {
        const: 'contact-1',
        title: 'Jane Smith',
        type: 'Lead',
        description: 'Lead - contact-1',
        toNumberEntity: true,
      },
      {
        const: 'new-contact',
        title: 'New Contact',
        isNewContact: true,
        defaultContactType: 'Lead',
      },
      {
        const: 'searchContact',
        ignoreAdditionalFields: true,
      },
    ]);
    expect(utils.buildContactWarningField(utils.buildContactOptions([...contacts, existingContact({ id: 'contact-3', name: 'Third' })], true), contacts[0]))
      .toHaveProperty('warning');
    expect(utils.buildContactWarningField([utils.buildContactOptions([newContact()], false)[0]], { isNewContact: true }))
      .toHaveProperty('warning');
    expect(utils.buildNewContactWidget(newContact(), manifest(), 'salesforce')).toMatchObject({
      newContactType: {},
      newContactName: expect.objectContaining({ 'ui:placeholder': expect.any(String) }),
    });

    const result = utils.buildAdditionalFieldsSchema({
      allAdditionalFields: manifest().platforms.salesforce.page.callLog.additionalFields,
      contact: existingContact({
        additionalInfo: {
          disposition: [{ const: 'demo', title: 'Demo' }],
          priority: [{ const: 'high', title: 'High' }],
        },
      }),
      logInfo: {
        dispositions: {
          disposition: 'manual',
          caseId: 'CASE-123',
        },
      },
    });

    expect(result.additionalFields).toMatchObject({
      disposition: {
        oneOf: [
          { const: 'demo', title: 'Demo' },
          { const: 'none', title: expect.any(String) },
          { const: 'manual', title: 'manual' },
        ],
        associationField: true,
      },
      priority: {
        oneOf: [{ const: 'high', title: 'High' }],
      },
      followUp: { type: 'boolean' },
      caseId: { type: 'string', pattern: '^CASE-[0-9]+$' },
      callWarning: { description: 'Check details' },
    });
    expect(result.additionalFieldsValue).toMatchObject({
      disposition: 'manual',
      followUp: true,
      caseId: 'CASE-123',
    });
    expect(result.additionalWarningUISchemas.callWarning).toMatchObject({
      'ui:field': 'admonition',
      'ui:severity': 'warning',
    });
    expect(result.requiredFieldNames).toEqual(['disposition', 'followUp', 'caseId']);
  });

  it('builds a reusable single-contact message log section', async () => {
    const utils = await loadLogPageUtils();

    const section = utils.buildSingleContactSection({
      contactInfo: [newContact()],
      manifest: manifest(),
      platformName: 'salesforce',
      logInfo: null,
      useContactSearch: false,
      id: 'message-1',
      contactPhoneNumber: '+16505550100',
    });

    expect(section.sectionSchema.required).toEqual(expect.arrayContaining(['newCategory', 'newContactName']));
    expect(section.sectionSchema.properties.contact.oneOf[0]).toMatchObject({
      const: 'new-contact',
      isNewContact: true,
    });
    expect(section.sectionUISchema.newContactName).toHaveProperty('ui:placeholder');
    expect(section.sectionFormData).toMatchObject({
      id: 'message-1',
      contact: 'new-contact',
      newContactType: 'Lead',
      triggerType: 'createLog',
      logType: 'Message',
      contactPhoneNumber: '+16505550100',
    });
  });
});

describe('logPage', () => {
  beforeEach(() => {
    vi.mocked(logCore.getConflictContentFromUnresolvedLog).mockReset();
  });

  it('renders a create call log page and updates schedule/contact/additional-field state', async () => {
    vi.setSystemTime(new Date('2026-07-03T08:00:00.000Z'));
    const logPage = await loadLogPage();
    const page = logPage.getLogPageRender({
      id: 'session-1',
      manifest: manifest(),
      logType: 'Call',
      triggerType: 'createLog',
      platformName: 'salesforce',
      direction: 'Inbound',
      contactInfo: [existingContact(), newContact(), existingContact({ id: 'contact-2', name: 'Alex Green', type: 'Contact', toNumberEntity: false })],
      logInfo: {
        note: 'cached note',
        subject: '',
        dispositions: { disposition: 'support' },
      },
      loggedContactId: null,
      isUnresolved: true,
      contactPhoneNumber: '+16505550100',
      useContactSearch: true,
    });

    expect(page).toMatchObject({
      schema: {
        properties: {
          contact: { oneOf: expect.any(Array) },
          activityTitle: { type: 'string' },
          callbackDateTime: expect.any(Object),
          disposition: expect.any(Object),
          callWarning: expect.any(Object),
        },
      },
      formData: {
        id: 'session-1',
        contact: 'contact-1',
        triggerType: 'createLog',
        logType: 'Call',
        contactPhoneNumber: '+16505550100',
        isUnresolved: true,
        note: 'cached note',
        scheduleCallback: false,
        disposition: 'support',
      },
    });
    expect(page.uiSchema.callbackDateTime).toEqual({ 'ui:widget': 'hidden' });

    const scheduled = logPage.getUpdatedLogPageRender({
      manifest: manifest(),
      logType: 'Call',
      platformName: 'salesforce',
      updateData: {
        keys: ['scheduleCallback'],
        page,
        formData: { ...page.formData, scheduleCallback: true, callbackDateTime: '' },
      },
    });
    expect(scheduled.schema.required).toContain('callbackDateTime');
    expect(scheduled.uiSchema.submitButtonOptions['ui:disabled']).toBe(true);

    const validCallback = logPage.getUpdatedLogPageRender({
      manifest: manifest(),
      logType: 'Call',
      platformName: 'salesforce',
      updateData: {
        keys: ['callbackDateTime'],
        page: scheduled,
        formData: { ...scheduled.formData, scheduleCallback: true, callbackDateTime: '2026-07-04T10:00:00' },
      },
    });
    expect(validCallback.uiSchema.submitButtonOptions['ui:disabled']).toBe(false);

    const invalidCase = logPage.getUpdatedLogPageRender({
      manifest: manifest(),
      logType: 'Call',
      platformName: 'salesforce',
      updateData: {
        keys: ['caseId'],
        page: validCallback,
        formData: { ...validCallback.formData, caseId: 'bad-case' },
      },
    });
    expect(invalidCase.schema.properties['caseId-error']).toMatchObject({
      type: 'string',
    });

    const switched = logPage.getUpdatedLogPageRender({
      manifest: manifest(),
      logType: 'Call',
      platformName: 'salesforce',
      updateData: {
        keys: ['contact'],
        page: validCallback,
        formData: { ...validCallback.formData, contact: 'new-contact' },
      },
    });
    expect(switched.formData).toMatchObject({
      contact: 'new-contact',
      newContactType: 'Lead',
      contactName: 'New Contact',
    });
    expect(switched.schema.required).toEqual(expect.arrayContaining(['newContactName', 'newCategory']));

    const editedTitle = logPage.getUpdatedLogPageRender({
      manifest: manifest(),
      logType: 'Call',
      platformName: 'salesforce',
      updateData: {
        keys: ['activityTitle'],
        page: switched,
        formData: { ...switched.formData, activityTitle: 'Manual title' },
      },
    });
    expect(editedTitle.schema.properties.activityTitle.manuallyEdited).toBe(true);
  });

  it('clears callback date and required state when scheduling is cancelled', async () => {
    vi.setSystemTime(new Date('2026-07-03T08:00:00.000Z'));
    const { logPage, basePage } = await createAdvancedCallLogPage();

    const scheduled = updateCallLogPage(logPage, basePage, ['scheduleCallback'], {
      scheduleCallback: true,
      callbackDateTime: '',
    });
    const unscheduled = updateCallLogPage(logPage, scheduled, ['scheduleCallback'], {
      scheduleCallback: false,
      callbackDateTime: '2026-07-04T10:00:00',
    });

    expect(unscheduled.formData.callbackDateTime).toBe('');
    expect(unscheduled.schema.required).not.toContain('callbackDateTime');
    expect(unscheduled.uiSchema.submitButtonOptions['ui:disabled']).toBe(false);
  });

  it('clears past callback dates and disables call-log submission', async () => {
    vi.setSystemTime(new Date('2026-07-03T08:00:00.000Z'));
    const { logPage, basePage } = await createAdvancedCallLogPage();
    const scheduled = updateCallLogPage(logPage, basePage, ['scheduleCallback'], {
      scheduleCallback: true,
      callbackDateTime: '',
    });

    const pastCallback = updateCallLogPage(logPage, scheduled, ['callbackDateTime'], {
      scheduleCallback: true,
      callbackDateTime: '2026-07-02T10:00:00',
    });

    expect(pastCallback.formData.callbackDateTime).toBe('');
    expect(pastCallback.uiSchema.submitButtonOptions['ui:disabled']).toBe(true);
  });

  it('switches from new-contact fields back to existing-contact call-log fields', async () => {
    vi.setSystemTime(new Date('2026-07-03T08:00:00.000Z'));
    const { logPage, basePage } = await createAdvancedCallLogPage();

    const existing = updateCallLogPage(logPage, basePage, ['contact'], {
      contact: 'contact-1',
      activityTitle: 'Outbound Call to ',
    });

    expect(existing.formData).toMatchObject({
      contact: 'contact-1',
      contactName: 'Jane Smith',
      newContactName: '',
      newContactType: '',
    });
    expect(existing.uiSchema.newContactName).toEqual({ 'ui:widget': 'hidden' });
    expect(existing.schema.required).not.toContain('newContactName');
    expect(existing.schema.required).toEqual(expect.arrayContaining(['disposition', 'followUp', 'caseId']));
  });

  it('removes contact-dependent fields when switching to contact search', async () => {
    vi.setSystemTime(new Date('2026-07-03T08:00:00.000Z'));
    const { logPage, basePage } = await createAdvancedCallLogPage();
    const existing = updateCallLogPage(logPage, basePage, ['contact'], {
      contact: 'contact-1',
      activityTitle: 'Outbound Call to ',
    });

    const searchContact = updateCallLogPage(logPage, existing, ['contact'], {
      contact: 'searchContact',
    });

    expect(searchContact.formData.contact).toBe('searchContact');
    expect(searchContact.schema.properties).not.toHaveProperty('disposition');
  });

  it('updates contact-type-dependent options and removes stale values after contact type changes', async () => {
    vi.setSystemTime(new Date('2026-07-03T08:00:00.000Z'));
    const { logPage, basePage } = await createAdvancedCallLogPage();

    const newContactAgain = updateCallLogPage(logPage, basePage, ['contact'], {
      contact: 'new-contact',
      activityTitle: 'Outbound Call to ',
    });
    const renamed = updateCallLogPage(logPage, newContactAgain, ['newContactName'], {
      newContactName: 'Manual New Lead',
    });
    expect(renamed.formData.newContactName).toBe('Manual New Lead');

    renamed.schema.properties.newOnly = { title: 'New Only', type: 'string' };
    renamed.formData.newOnly = 'lead-only';
    renamed.uiSchema.newOnly = {};
    const contactTypeChanged = updateCallLogPage(logPage, renamed, ['newContactType'], {
      newContactType: 'Contact',
      newCategory: 'prospect',
    });

    expect(contactTypeChanged.schema.properties.newCategory.oneOf).toEqual([
      { const: 'customer', title: 'Customer' },
      { const: 'none', title: expect.any(String) },
    ]);
    expect(contactTypeChanged.formData.newCategory).toBeUndefined();
    expect(contactTypeChanged.schema.properties).not.toHaveProperty('newOnly');
  });

  it('clears pattern validation errors after a valid call-log field value is entered', async () => {
    const logPage = await loadLogPage();
    const page = logPage.getLogPageRender({
      id: 'session-pattern',
      manifest: manifest(),
      logType: 'Call',
      triggerType: 'createLog',
      platformName: 'salesforce',
      direction: 'Inbound',
      contactInfo: [existingContact()],
      logInfo: {},
      contactPhoneNumber: '+16505550100',
    });

    const invalidCase = logPage.getUpdatedLogPageRender({
      manifest: manifest(),
      logType: 'Call',
      platformName: 'salesforce',
      updateData: {
        keys: ['caseId'],
        page,
        formData: { ...page.formData, caseId: 'bad-case' },
      },
    });
    expect(invalidCase.schema.properties['caseId-error']).toBeDefined();

    const validCase = logPage.getUpdatedLogPageRender({
      manifest: manifest(),
      logType: 'Call',
      platformName: 'salesforce',
      updateData: {
        keys: ['caseId'],
        page: invalidCase,
        formData: { ...invalidCase.formData, caseId: 'CASE-42' },
      },
    });
    expect(validCase.schema.properties['caseId-error']).toBeUndefined();
    expect(validCase.uiSchema['caseId-error']).toBeUndefined();
  });

  it('renders contact search as a button when it is the only contact option', async () => {
    const logPage = await loadLogPage();
    const page = logPage.getLogPageRender({
      id: 'search-only',
      manifest: manifest(),
      logType: 'Call',
      triggerType: 'createLog',
      platformName: 'salesforce',
      direction: 'Outbound',
      contactInfo: [],
      logInfo: {},
      contactPhoneNumber: '+16505550100',
      useContactSearch: true,
    });

    expect(page.schema.properties.contact.oneOf).toEqual([
      expect.objectContaining({ const: 'searchContact' }),
    ]);
    expect(page.schema.properties.contact).toMatchObject({
      title: expect.any(String),
      type: 'string',
    });
    expect(page.uiSchema.contact).toEqual({
      'ui:field': 'button',
      'ui:variant': 'contained',
      'ui:fullWidth': true,
    });
    expect(page.uiSchema.submitButtonOptions['ui:disabled']).toBe(true);
    expect(page.schema.required).toContain('contact');
    expect(page.formData.contact).toBe('');
    expect(page.formData.contactName).toBe('');

    const updatedPage = logPage.getUpdatedLogPageRender({
      manifest: manifest(),
      logType: 'Call',
      platformName: 'salesforce',
      updateData: {
        keys: ['scheduleCallback'],
        page,
        formData: {
          ...page.formData,
          contact: 'searchContact',
          scheduleCallback: false,
        },
      },
    });

    expect(updatedPage.uiSchema.submitButtonOptions['ui:disabled']).toBe(true);
    expect(updatedPage.schema.required).toContain('contact');
    expect(updatedPage.formData.contact).toBe('');
  });

  it('renders edit log and message log pages with current form data', async () => {
    const logPage = await loadLogPage();

    const editPage = logPage.getLogPageRender({
      id: 'log-1',
      manifest: manifest(),
      logType: 'Call',
      triggerType: 'editLog',
      platformName: 'salesforce',
      direction: 'Outbound',
      contactInfo: [existingContact()],
      logInfo: {
        subject: 'Existing title',
        note: 'Existing note',
      },
      loggedContactId: 'contact-1',
      contactPhoneNumber: '+16505550100',
      useContactSearch: false,
    });

    expect(editPage).toMatchObject({
      title: expect.any(String),
      schema: {
        required: ['activityTitle'],
      },
      formData: {
        id: 'log-1',
        contact: 'contact-1',
        activityTitle: 'Existing title',
        note: 'Existing note',
      },
    });

    const messagePage = logPage.getLogPageRender({
      id: 'message-1',
      manifest: manifest(),
      logType: 'Message',
      triggerType: 'manual',
      platformName: 'salesforce',
      direction: 'Outbound',
      contactInfo: [existingContact()],
      logInfo: {},
      contactPhoneNumber: '+16505550200',
      useContactSearch: false,
    });

    expect(messagePage.schema.properties).not.toHaveProperty('activityTitle');
    expect(messagePage.formData).toMatchObject({
      id: 'message-1',
      logType: 'Message',
      contactPhoneNumber: '+16505550200',
      messageType: 'sms',
    });
  });

  it('renders fallback edit and new-contact-only log pages', async () => {
    const logPage = await loadLogPage();
    const noContactTypesManifest = manifest();
    delete noContactTypesManifest.platforms.salesforce.contactTypes;

    const editPage = logPage.getLogPageRender({
      id: 'log-fallback',
      manifest: manifest(),
      logType: 'Call',
      triggerType: 'editLog',
      platformName: 'salesforce',
      direction: 'Inbound',
      contactInfo: [existingContact()],
      logInfo: null,
      loggedContactId: null,
      contactPhoneNumber: '+16505550100',
      useContactSearch: false,
    });

    expect(editPage.formData).toMatchObject({
      contact: 'contact-1',
      activityTitle: '',
      note: '',
    });

    const newOnly = logPage.getLogPageRender({
      id: 'new-only',
      manifest: noContactTypesManifest,
      logType: 'Message',
      triggerType: 'manual',
      platformName: 'salesforce',
      direction: 'Outbound',
      contactInfo: [newContact()],
      logInfo: {},
      contactPhoneNumber: '+16505550199',
      useContactSearch: false,
    });

    expect(newOnly.schema.required).toEqual(expect.arrayContaining(['newCategory', 'newContactName']));
    expect(newOnly.schema.properties.warning).toBeDefined();
    expect(newOnly.schema.properties.newContactType.oneOf).toEqual([]);
    expect(newOnly.uiSchema.newContactType).toEqual({ 'ui:widget': 'hidden' });
  });

  it('renders log pages with fallback contacts and no additional field config', async () => {
    const logPage = await loadLogPage();
    const minimalManifest = {
      platforms: {
        salesforce: {
          displayName: 'Salesforce',
          page: {
            callLog: {},
            messageLog: {},
          },
        },
      },
    };

    const callPage = logPage.getLogPageRender({
      id: 'fallback-contact',
      manifest: minimalManifest,
      logType: 'Call',
      triggerType: 'createLog',
      platformName: 'salesforce',
      direction: 'Outbound',
      contactInfo: [{ id: 'fallback-id', type: 'Lead' }],
      logInfo: null,
      contactPhoneNumber: '+16505550100',
      useContactSearch: false,
    });

    expect(callPage.schema.properties.newContactType.oneOf).toEqual([]);
    expect(callPage.formData).toMatchObject({
      contact: 'fallback-id',
      contactName: '',
      isUnresolved: false,
      note: '',
    });
    expect(callPage.schema.properties).not.toHaveProperty('disposition');

    const editPage = logPage.getLogPageRender({
      id: 'fallback-edit',
      manifest: minimalManifest,
      logType: 'Call',
      triggerType: 'editLog',
      platformName: 'salesforce',
      direction: 'Inbound',
      contactInfo: [{ id: 'edit-contact', type: 'Contact' }],
      logInfo: null,
      loggedContactId: undefined,
      contactPhoneNumber: '+16505550101',
      useContactSearch: false,
    });

    expect(editPage.formData).toMatchObject({
      contact: 'edit-contact',
      activityTitle: '',
      note: '',
    });
  });

  it('handles callback updates with omitted required state and hidden date widgets', async () => {
    const logPage = await loadLogPage();
    const page = logPage.getLogPageRender({
      id: 'session-callback-optional',
      manifest: manifest(),
      logType: 'Call',
      triggerType: 'createLog',
      platformName: 'salesforce',
      direction: 'Outbound',
      contactInfo: [existingContact()],
      logInfo: {},
      contactPhoneNumber: '+16505550100',
      useContactSearch: false,
    });
    page.schema.required = undefined;

    const unscheduled = logPage.getUpdatedLogPageRender({
      manifest: manifest(),
      logType: 'Call',
      platformName: 'salesforce',
      updateData: {
        keys: ['scheduleCallback'],
        page,
        formData: { ...page.formData, scheduleCallback: false, callbackDateTime: '2026-07-04T10:00:00' },
      },
    });

    expect(unscheduled.formData.callbackDateTime).toBe('');
    expect(unscheduled.schema.required).toBeUndefined();

    const unchangedHiddenDate = logPage.getUpdatedLogPageRender({
      manifest: manifest(),
      logType: 'Call',
      platformName: 'salesforce',
      updateData: {
        keys: ['callbackDateTime'],
        page: unscheduled,
        formData: { ...unscheduled.formData, scheduleCallback: false, callbackDateTime: '' },
      },
    });

    expect(unchangedHiddenDate.uiSchema.callbackDateTime).toEqual({ 'ui:widget': 'hidden' });
    expect(unchangedHiddenDate.uiSchema.submitButtonOptions['ui:disabled']).toBe(false);
  });

  it('keeps manually edited titles and clears contact type when no platform types exist', async () => {
    const logPage = await loadLogPage();
    const noContactTypesManifest = manifest();
    noContactTypesManifest.platforms.salesforce.contactTypes = [];
    const page = logPage.getLogPageRender({
      id: 'session-no-types',
      manifest: noContactTypesManifest,
      logType: 'Call',
      triggerType: 'createLog',
      platformName: 'salesforce',
      direction: 'Outbound',
      contactInfo: [existingContact(), newContact()],
      logInfo: {},
      contactPhoneNumber: '+16505550100',
      useContactSearch: false,
    });
    page.schema.properties.activityTitle.manuallyEdited = true;

    const newContactPage = logPage.getUpdatedLogPageRender({
      manifest: noContactTypesManifest,
      logType: 'Call',
      platformName: 'salesforce',
      updateData: {
        keys: ['contact'],
        page,
        formData: { ...page.formData, contact: 'new-contact', activityTitle: 'Manual title' },
      },
    });

    expect(newContactPage.formData).toMatchObject({
      newContactType: '',
      activityTitle: 'Manual title',
    });
    expect(newContactPage.uiSchema.newContactType).toEqual({ 'ui:widget': 'hidden' });

    const existingPage = logPage.getUpdatedLogPageRender({
      manifest: noContactTypesManifest,
      logType: 'Call',
      platformName: 'salesforce',
      updateData: {
        keys: ['contact'],
        page: newContactPage,
        formData: { ...newContactPage.formData, contact: 'contact-1', activityTitle: 'Manual title' },
      },
    });

    expect(existingPage.formData.activityTitle).toBe('Manual title');
    expect(existingPage.formData.newContactType).toBe('');
  });

  it('updates defensive callback state and contact-dependent missing fields', async () => {
    const logPage = await loadLogPage();
    const page = logPage.getLogPageRender({
      id: 'session-defensive',
      manifest: manifest(),
      logType: 'Call',
      triggerType: 'createLog',
      platformName: 'salesforce',
      direction: 'Inbound',
      contactInfo: [existingContact(), existingContact({
        id: 'contact-2',
        name: 'No Flag',
        type: 'Contact',
        toNumberEntity: false,
        additionalInfo: {
          disposition: [{ const: 'support', title: 'Support' }],
          priority: [{ const: 'normal', title: 'Normal' }],
        },
      })],
      logInfo: {},
      contactPhoneNumber: '+16505550100',
      useContactSearch: false,
    });
    page.schema.required = undefined;
    delete page.schema.properties.callbackDateTime;

    const scheduled = logPage.getUpdatedLogPageRender({
      manifest: manifest(),
      logType: 'Call',
      platformName: 'salesforce',
      updateData: {
        keys: ['scheduleCallback'],
        page,
        formData: { ...page.formData, scheduleCallback: true, callbackDateTime: '' },
      },
    });

    expect(scheduled.schema.required).toEqual(['callbackDateTime']);
    expect(scheduled.schema.properties.callbackDateTime).toMatchObject({
      title: expect.any(String),
      type: 'string',
      format: 'date-time',
    });

    const customManifest: any = manifest();
    customManifest.platforms.salesforce.page.callLog.additionalFields.push({
      const: 'missingFlag',
      title: 'Missing Flag',
      type: 'checkbox',
      contactDependent: true,
      required: true,
      defaultValue: true,
    });
    const switched = logPage.getUpdatedLogPageRender({
      manifest: customManifest,
      logType: 'Call',
      platformName: 'salesforce',
      updateData: {
        keys: ['contact'],
        page: scheduled,
        formData: { ...scheduled.formData, contact: 'contact-2' },
      },
    });

    expect(switched.schema.properties).not.toHaveProperty('missingFlag');
    expect(switched.schema.properties).toHaveProperty('hiddenForLead');
    expect(switched.formData.contactName).toBe('No Flag');
  });

  it('renders unlogged call list metadata and duration formatting', async () => {
    vi.mocked(logCore.getConflictContentFromUnresolvedLog)
      .mockReturnValueOnce({ title: 'Inbound Jane', description: 'No match', type: 'Call' })
      .mockReturnValueOnce({ title: 'Message Alex', description: '', type: 'Message' })
      .mockReturnValueOnce({ title: 'Outbound Pat', description: '', type: 'Call' });
    const logPage = await loadLogPage();

    const page = logPage.getUnloggedCallPageRender({
      unloggedCalls: [
        { sessionId: 'call-1', startTime: '2026-07-03T08:00:00Z', duration: 65, direction: 'Inbound' },
        { sessionId: 'msg-1', startTime: '2026-07-02T08:00:00Z', duration: 3661, direction: 'Outbound' },
        { sessionId: 'call-2', startTime: '2026-07-02T09:00:00Z', duration: 9, direction: 'Outbound' },
      ],
    });

    expect(page).toMatchObject({
      id: 'unloggedCallPage',
      unreadCount: 3,
      schema: {
        properties: {
          record: {
            oneOf: [
              expect.objectContaining({ const: 'call-1', title: 'Inbound Jane', description: '01:05 - No match' }),
              expect.objectContaining({ const: 'msg-1', title: 'Message Alex', description: '01:01:01' }),
              expect.objectContaining({ const: 'call-2', title: 'Outbound Pat', description: '00:09' }),
            ],
          },
        },
      },
    });
  });
});

describe('groupLogPage', () => {
  it('renders an empty group form when no correspondent data is available', async () => {
    const groupLogPage = await loadGroupLogPage();

    const page = groupLogPage.getGroupLogPageRender({
      id: 'empty-group',
      manifest: manifest(),
      platformName: 'salesforce',
      correspondentsData: null,
      useContactSearch: false,
    });

    expect(page.schema.properties).toEqual({});
    expect(page.formData).toEqual({});
  });

  it('renders sections from array and object correspondent inputs and updates contact-specific fields', async () => {
    const groupLogPage = await loadGroupLogPage();
    const rendered = groupLogPage.getGroupLogPageRender({
      id: 'group-1',
      manifest: manifest(),
      platformName: 'salesforce',
      correspondentsData: {
        '+16505550100': [existingContact()],
        '+16505550200': [newContact()],
      },
      useContactSearch: true,
    });

    expect(Object.keys(rendered.schema.properties)).toEqual(['section_0', 'section_1']);
    expect(rendered.formData.section_0).toMatchObject({
      id: 'group-1',
      contact: 'contact-1',
      logType: 'Message',
      contactPhoneNumber: '+16505550100',
      messageType: 'sms',
    });
    expect(rendered.formData.section_1).toMatchObject({
      contact: 'new-contact',
      newContactType: 'Lead',
    });

    const sectionContact = rendered.schema.properties.section_0.properties.contact.oneOf[1];
    rendered.formData.section_0.contact = sectionContact.const;
    const updated = groupLogPage.getUpdatedGroupLogPageRender({
      manifest: manifest(),
      platformName: 'salesforce',
      updateData: {
        keys: ['section_0', 'contact'],
        page: rendered,
        formData: rendered.formData,
      },
    });
    expect(updated.formData.section_0.contactName).toBe(sectionContact.title);

    updated.formData.section_0.messageType = 'bad';
    const untouched = groupLogPage.getUpdatedGroupLogPageRender({
      manifest: manifest(),
      platformName: 'salesforce',
      updateData: {
        keys: ['section_9', 'contact'],
        page: updated,
        formData: updated.formData,
      },
    });
    expect(untouched).toBe(updated);
  });

  it('updates grouped new-contact sections with additional fields and validation state', async () => {
    const groupLogPage = await loadGroupLogPage();
    const groupedManifest = richMessageManifest();
    const searchableNewContact = {
      ...newContact(),
      additionalInfo: {
        ...newContact().additionalInfo,
        Contact: {
          newCategory: [{ const: 'customer', title: 'Customer' }],
        },
        messageType: [{ const: 'sms', title: 'SMS' }],
        skipMemo: true,
      },
    };
    const page = groupLogPage.getGroupLogPageRender({
      id: 'group-new',
      manifest: groupedManifest,
      platformName: 'salesforce',
      correspondentsData: [
        {
          phoneNumber: '+16505550400',
          displayName: 'New person',
          contactInfo: [searchableNewContact],
        },
      ],
      useContactSearch: false,
    });

    const updated = groupLogPage.getUpdatedGroupLogPageRender({
      manifest: groupedManifest,
      platformName: 'salesforce',
      updateData: {
        keys: ['section_0', 'contact'],
        page,
        formData: page.formData,
      },
    });

    expect(updated.uiSchema.section_0.newContactType).toEqual({});
    expect(updated.formData.section_0).toMatchObject({
      contact: 'new-contact',
      contactName: 'New Contact',
      newContactType: 'Lead',
      messageType: 'sms',
      messageFlag: true,
    });
    expect(updated.schema.properties.section_0.required).toEqual(expect.arrayContaining([
      'newContactName',
      'messageType',
      'messageFlag',
      'messageMemo',
      'newCategory',
    ]));
    expect(updated.schema.properties.section_0.properties.messageWarning).toMatchObject({
      description: 'Check message details',
    });
    expect(updated.schema.properties.section_0.properties).not.toHaveProperty('missingSelection');
    expect(updated.schema.properties.section_0.properties).not.toHaveProperty('skipMemo');

    updated.schema.properties.section_0.properties.messageMemo.pattern = '^OK-[0-9]+$';
    const invalid = groupLogPage.getUpdatedGroupLogPageRender({
      manifest: groupedManifest,
      platformName: 'salesforce',
      updateData: {
        keys: ['section_0', 'messageMemo'],
        page: updated,
        formData: {
          ...updated.formData,
          section_0: {
            ...updated.formData.section_0,
            messageMemo: 'bad',
          },
        },
      },
    });
    expect(invalid.schema.properties.section_0.properties['messageMemo-error']).toMatchObject({
      type: 'string',
    });

    const valid = groupLogPage.getUpdatedGroupLogPageRender({
      manifest: groupedManifest,
      platformName: 'salesforce',
      updateData: {
        keys: ['section_0', 'messageMemo'],
        page: invalid,
        formData: {
          ...invalid.formData,
          section_0: {
            ...invalid.formData.section_0,
            messageMemo: 'OK-1',
          },
        },
      },
    });
    expect(valid.schema.properties.section_0.properties['messageMemo-error']).toBeUndefined();

    const contactTypeChanged = groupLogPage.getUpdatedGroupLogPageRender({
      manifest: groupedManifest,
      platformName: 'salesforce',
      updateData: {
        keys: ['section_0', 'newContactType'],
        page: valid,
        formData: {
          ...valid.formData,
          section_0: {
            ...valid.formData.section_0,
            newContactType: 'Contact',
            newCategory: 'prospect',
          },
        },
      },
    });
    expect(contactTypeChanged.schema.properties.section_0.properties.newCategory.oneOf).toEqual([
      { const: 'customer', title: 'Customer' },
      { const: 'none', title: expect.any(String) },
    ]);
    expect(contactTypeChanged.formData.section_0.newCategory).toBeUndefined();
  });

  it('switches grouped existing contacts to new-contact fields with no type config', async () => {
    const groupLogPage = await loadGroupLogPage();
    const groupedManifest = manifest();
    groupedManifest.platforms.salesforce.contactTypes = [];
    delete groupedManifest.platforms.salesforce.page.newContact.additionalFields;
    const page = groupLogPage.getGroupLogPageRender({
      id: 'group-no-types',
      manifest: groupedManifest,
      platformName: 'salesforce',
      correspondentsData: [
        {
          phoneNumber: '+16505550500',
          displayName: 'Fallback',
          contactInfo: [
            existingContact(),
            {
              ...newContact(),
              additionalInfo: {
                ...newContact().additionalInfo,
                messageType: [{ const: 'sms', title: 'SMS' }],
              },
            },
          ],
        },
      ],
      useContactSearch: false,
    });

    const updated = groupLogPage.getUpdatedGroupLogPageRender({
      manifest: groupedManifest,
      platformName: 'salesforce',
      updateData: {
        keys: ['section_0', 'contact'],
        page,
        formData: {
          ...page.formData,
          section_0: {
            ...page.formData.section_0,
            contact: 'new-contact',
          },
        },
      },
    });

    expect(updated.formData.section_0).toMatchObject({
      contact: 'new-contact',
      newContactType: '',
      contactName: 'New Contact',
      messageType: 'sms',
    });
    expect(updated.schema.properties.section_0.required).toEqual(expect.arrayContaining(['newContactName', 'messageType']));
    expect(updated.uiSchema.section_0.newContactType).toEqual({ 'ui:widget': 'hidden' });
  });

  it('handles grouped update fallbacks for missing sections, contacts, and optional form buckets', async () => {
    const groupLogPage = await loadGroupLogPage();
    const page = groupLogPage.getGroupLogPageRender({
      id: 'group-fallbacks',
      manifest: manifest(),
      platformName: 'salesforce',
      correspondentsData: [
        {
          phoneNumber: '+16505550600',
          displayName: 'Jane',
          contactInfo: [existingContact()],
        },
      ],
      useContactSearch: false,
    });

    const missingFieldKey = groupLogPage.getUpdatedGroupLogPageRender({
      manifest: manifest(),
      platformName: 'salesforce',
      updateData: {
        keys: ['section_0'],
        page,
        formData: page.formData,
      },
    });
    expect(missingFieldKey).toBe(page);

    delete page.uiSchema.section_0;
    delete page.formData.section_0;
    const missingContact = groupLogPage.getUpdatedGroupLogPageRender({
      manifest: manifest(),
      platformName: 'salesforce',
      updateData: {
        keys: ['section_0', 'contact'],
        page,
        formData: page.formData,
      },
    });

    expect(missingContact.uiSchema.section_0).toEqual({});
    expect(missingContact.formData.section_0).toEqual({});
  });

  it('collects grouped form data with empty optional field definitions and new-contact labels', async () => {
    const groupLogPage = await loadGroupLogPage();
    const minimalManifest = {
      platforms: {
        salesforce: {
          page: {},
        },
      },
    };

    expect(groupLogPage.collectGroupLogFormData({
      section_0: {
        contact: 'new-contact',
        contactType: 'Lead',
        contactName: 'Fallback Lead',
        newContactName: 'Created Lead',
        newContactType: 'Contact',
        contactPhoneNumber: '+16505550700',
      },
      section_1: {
        contact: 'contact-1',
        contactType: 'Lead',
        contactName: 'Jane Smith',
        newContactName: '',
        newContactType: '',
        contactPhoneNumber: '+16505550701',
      },
    }, minimalManifest, 'salesforce')).toEqual([
      expect.objectContaining({
        contactType: 'Contact',
        contactName: 'Created Lead',
        additionalSubmission: {},
      }),
      expect.objectContaining({
        contactType: 'Lead',
        contactName: 'Jane Smith',
        additionalSubmission: {},
      }),
    ]);
  });

  it('collects grouped form data into log submissions', async () => {
    const groupLogPage = await loadGroupLogPage();
    const page = groupLogPage.getGroupLogPageRender({
      id: 'group-2',
      manifest: manifest(),
      platformName: 'salesforce',
      correspondentsData: [
        {
          phoneNumber: '+16505550300',
          displayName: 'Jane',
          contactInfo: [existingContact()],
          logInfo: { dispositions: { messageType: 'sms' } },
        },
      ],
      useContactSearch: false,
    });

    expect(groupLogPage.collectGroupLogFormData(page.formData, manifest(), 'salesforce')).toEqual([
      expect.objectContaining({
        contact: 'contact-1',
        contactName: 'Jane Smith',
        contactType: 'Lead',
        contactPhoneNumber: '+16505550300',
        additionalSubmission: {
          messageType: 'sms',
          messageFlag: false,
        },
      }),
    ]);
  });
});
