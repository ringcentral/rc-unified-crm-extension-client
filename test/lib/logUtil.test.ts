import logService from '../../src/service/logService.ts';
import { getManifest } from '../../src/service/manifestService.ts';
import { getPlatformInfo } from '../../src/service/platformService.ts';
import { loadModule } from '../helpers/loadModule';
import { readStorage, seedStorage } from '../setup/storageHelpers';

vi.mock('../../src/service/logService.ts', () => ({
  default: {
    syncCallData: vi.fn(),
  },
}));

vi.mock('../../src/service/manifestService.ts', () => ({
  getManifest: vi.fn(),
}));

vi.mock('../../src/service/platformService.ts', () => ({
  getPlatformInfo: vi.fn(),
}));

async function loadLogUtil() {
  vi.resetModules();
  return loadModule('../../src/lib/logUtil.ts');
}

function platform() {
  return {
    name: 'salesforce',
    page: {
      callLog: {
        additionalFields: [
          {
            const: 'disposition',
            defaultSettingId: 'defaultDisposition',
            defaultSettingValues: {
              inboundCall: {
                settingId: 'inboundDisposition',
              },
            },
            allowCustomValue: true,
          },
        ],
      },
    },
    settings: [
      {
        id: 'defaultDisposition',
        items: [
          {
            id: 'inboundDisposition',
            defaultValue: 'Demo',
          },
        ],
      },
    ],
  };
}

describe('logUtil', () => {
  it('defaults log page form data from user settings and matching field options', async () => {
    seedStorage({
      userSettings: {
        inboundDisposition: { value: 'demo' },
      },
    });
    const logUtil = await loadLogUtil();

    await expect(logUtil.logPageFormDataDefaulting({
      platform: platform(),
      targetPage: {
        schema: {
          properties: {
            disposition: {
              oneOf: [
                { const: 'Demo', title: 'Demo' },
                { const: 'Closed', title: 'Closed' },
              ],
            },
          },
        },
        formData: {},
      },
      caseType: 'inboundCall',
      logType: 'callLog',
    })).resolves.toMatchObject({
      formData: {
        disposition: 'Demo',
      },
    });
  });

  it('defaults custom and boolean additional fields when configured by settings', async () => {
    seedStorage({
      userSettings: {
        inboundDisposition: { value: 'Custom value' },
        defaultFlag: { value: true },
        allowBullhornCustomNoteAction: { value: true },
      },
    });
    const logUtil = await loadLogUtil();
    const targetPage = {
      schema: {
        properties: {
          disposition: {
            oneOf: [
              { const: 'Demo', title: 'Demo' },
            ],
          },
          flag: {
            type: 'boolean',
          },
        },
      },
      formData: {},
    };

    const result = await logUtil.logPageFormDataDefaulting({
      platform: {
        ...platform(),
        name: 'bullhorn',
        page: {
          callLog: {
            additionalFields: [
              {
                const: 'disposition',
                defaultSettingId: 'defaultDisposition',
                defaultSettingValues: {
                  inboundCall: { settingId: 'inboundDisposition' },
                },
                allowCustomValue: true,
              },
              {
                const: 'flag',
                defaultSettingId: 'flagSetting',
                defaultSettingValues: {
                  inboundCall: { settingId: 'defaultFlag' },
                },
              },
            ],
          },
        },
        settings: [
          ...platform().settings,
          {
            id: 'flagSetting',
            items: [
              {
                id: 'defaultFlag',
                defaultValue: false,
              },
            ],
          },
        ],
      },
      targetPage,
      caseType: 'inboundCall',
      logType: 'callLog',
    });

    expect(result.formData).toMatchObject({
      disposition: 'Custom value',
      flag: true,
    });
    expect(result.schema.properties.disposition.oneOf).toEqual(expect.arrayContaining([
      { const: 'Custom value', title: 'Custom value' },
    ]));
  });

  it('leaves defaults unset when settings are missing or custom values are disallowed', async () => {
    seedStorage({
      userSettings: {
        inboundDisposition: { value: 'Custom value' },
        defaultFlag: { value: false },
        allowBullhornCustomNoteAction: { value: false },
      },
    });
    const logUtil = await loadLogUtil();

    await expect(logUtil.logPageFormDataDefaulting({
      platform: {
        name: 'salesforce',
        page: {
          callLog: {
            additionalFields: [],
          },
        },
      },
      targetPage: {
        schema: { properties: {} },
        formData: {},
      },
      caseType: 'inboundCall',
      logType: 'callLog',
    })).resolves.toMatchObject({
      formData: {},
    });

    const result = await logUtil.logPageFormDataDefaulting({
      platform: {
        ...platform(),
        name: 'bullhorn',
        page: {
          callLog: {
            additionalFields: [
              {
                const: 'disposition',
                defaultSettingId: 'defaultDisposition',
                defaultSettingValues: {
                  inboundCall: { settingId: 'inboundDisposition' },
                },
                allowCustomValue: true,
              },
              {
                const: 'missingDefault',
                defaultSettingId: 'missingSetting',
                defaultSettingValues: {
                  inboundCall: { settingId: 'missingValue' },
                },
              },
              {
                const: 'flag',
                defaultSettingId: 'flagSetting',
                defaultSettingValues: {
                  inboundCall: { settingId: 'defaultFlag' },
                },
              },
            ],
          },
        },
        settings: [
          ...platform().settings,
          {
            id: 'flagSetting',
            items: [
              {
                id: 'differentFlag',
                defaultValue: true,
              },
            ],
          },
        ],
      },
      targetPage: {
        schema: {
          properties: {
            disposition: {
              oneOf: [
                { const: 'Demo', title: 'Demo' },
              ],
            },
            flag: {
              type: 'boolean',
            },
          },
        },
        formData: {},
      },
      caseType: 'inboundCall',
      logType: 'callLog',
    });

    expect(result.formData).toEqual({});
    expect(result.schema.properties.disposition.oneOf).toEqual([
      { const: 'Demo', title: 'Demo' },
    ]);
  });

  it('classifies unknown and multiple contact conflicts for auto logging', async () => {
    const logUtil = await loadLogUtil();

    await expect(logUtil.getLogConflictInfo({
      platform: platform(),
      isAutoLog: true,
      contactInfo: [{ isNewContact: true }],
      logType: 'callLog',
      direction: 'Inbound',
    })).resolves.toMatchObject({
      hasConflict: true,
      conflictType: 'Unknown contact',
    });

    await expect(logUtil.getLogConflictInfo({
      platform: platform(),
      isAutoLog: true,
      contactInfo: [
        { id: 'contact-1', isNewContact: false },
        { id: 'contact-2', isNewContact: false },
      ],
      logType: 'callLog',
      direction: 'Inbound',
    })).resolves.toMatchObject({
      hasConflict: true,
      conflictType: 'Multiple contacts',
    });
  });

  it('uses to-number contacts and numeric default values for outbound call conflicts', async () => {
    seedStorage({
      userSettings: {
        outboundDisposition: { value: 2 },
      },
    });
    const logUtil = await loadLogUtil();

    await expect(logUtil.getLogConflictInfo({
      platform: {
        name: 'salesforce',
        page: {
          callLog: {
            additionalFields: [
              {
                const: 'disposition',
                defaultSettingId: 'defaultDisposition',
                defaultSettingValues: {
                  outboundCall: { settingId: 'outboundDisposition' },
                },
              },
            ],
          },
        },
        settings: [
          {
            id: 'defaultDisposition',
            items: [
              {
                id: 'outboundDisposition',
                defaultValue: 1,
              },
            ],
          },
        ],
      },
      isAutoLog: true,
      contactInfo: [
        {
          id: 'to-number',
          isNewContact: false,
          toNumberEntity: true,
          additionalInfo: {
            disposition: [
              { const: 1, title: 'One' },
              { const: 2, title: 'Two' },
            ],
          },
        },
        {
          id: 'other-contact',
          isNewContact: false,
        },
      ],
      logType: 'callLog',
      direction: 'Outbound',
    })).resolves.toMatchObject({
      hasConflict: false,
      autoSelectAdditionalSubmission: {
        disposition: 2,
      },
    });
  });

  it('auto-selects a single additional-field option without conflict', async () => {
    const logUtil = await loadLogUtil();

    await expect(logUtil.getLogConflictInfo({
      platform: platform(),
      isAutoLog: true,
      contactInfo: [
        {
          id: 'contact-1',
          isNewContact: false,
          additionalInfo: {
            disposition: [
              { const: 'Demo', title: 'Demo' },
            ],
          },
        },
      ],
      logType: 'callLog',
      direction: 'Inbound',
    })).resolves.toMatchObject({
      hasConflict: false,
      autoSelectAdditionalSubmission: {
        disposition: 'Demo',
      },
      conflictType: 'No conflict',
    });
  });

  it('parses supported contact date formats and rejects invalid dates', async () => {
    const logUtil = await loadLogUtil();
    const date = new Date('2026-07-03T08:00:00.000Z');

    expect(logUtil.parseContactDateValue(undefined)).toBeNull();
    expect(logUtil.parseContactDateValue(null)).toBeNull();
    expect(logUtil.parseContactDateValue(' ')).toBeNull();
    expect(logUtil.parseContactDateValue(date)).toBe(date.getTime());
    expect(logUtil.parseContactDateValue('20260703')).toBe(Date.UTC(2026, 6, 3));
    expect(logUtil.parseContactDateValue('20260703080910')).toBe(Date.UTC(2026, 6, 3, 8, 9, 10));
    expect(logUtil.parseContactDateValue('2026/07/03 08:09:10')).toBe(Date.UTC(2026, 6, 3, 8, 9, 10));
    expect(logUtil.parseContactDateValue('2026-07-03T08:09:10+0800')).toBe(Date.parse('2026-07-03T08:09:10.000+08:00'));
    expect(logUtil.parseContactDateValue('/Date(1783065600000+0000)/')).toBe(1783065600000);
    expect(logUtil.parseContactDateValue('July 3, 2026 08:00:00 UTC')).toBe(Date.parse('July 3, 2026 08:00:00 UTC'));
    expect(logUtil.parseContactDateValue('1783065600000000000')).toBe(1783065600000);
    expect(logUtil.parseContactDateValue('1783065600000000')).toBe(1783065600000);
    expect(logUtil.parseContactDateValue('1783065600')).toBe(1783065600000);
    expect(logUtil.parseContactDateValue('not-a-date')).toBeNull();
    expect(logUtil.parseContactDateValue('2026-02-30T08:00:00Z')).toBeNull();
    expect(logUtil.hasValidDateValue('2026-07-03')).toBe(true);
    expect(logUtil.hasValidDateValue('')).toBe(false);
  });

  it('resolves earliest created and most recent activity contacts by parsed timestamps', async () => {
    const logUtil = await loadLogUtil();
    const contacts = [
      {
        id: 'old-created-new-activity',
        createdDate: '1704067200',
        mostRecentActivityDate: '20240103120000',
      },
      {
        id: 'new-created-old-activity',
        createdDate: '2024-01-02T00:00:00Z',
        mostRecentActivityDate: '2024-01-02T12:00:00Z',
      },
      {
        id: 'placeholder',
        isNewContact: true,
        createdDate: '2020-01-01T00:00:00Z',
        mostRecentActivityDate: '2030-01-01T00:00:00Z',
      },
    ];

    expect(logUtil.parseContactDateValue('1704067200')).toBe(logUtil.parseContactDateValue('2024-01-01T00:00:00Z'));
    expect(logUtil.resolveEarliestCreatedContact(contacts)).toMatchObject({
      contact: expect.objectContaining({ id: 'old-created-new-activity' }),
      missingCreatedDate: false,
    });
    expect(logUtil.resolveMostRecentActivityContact(contacts)).toMatchObject({
      id: 'old-created-new-activity',
    });
  });

  it('reports missing created dates and empty activity matches', async () => {
    const logUtil = await loadLogUtil();

    expect(logUtil.resolveEarliestCreatedContact([
      { id: 'missing-created', createdDate: '' },
    ])).toEqual({
      contact: null,
      missingCreatedDate: true,
    });
    expect(logUtil.resolveEarliestCreatedContact([])).toEqual({
      contact: null,
      missingCreatedDate: false,
    });
    expect(logUtil.resolveMostRecentActivityContact([
      { id: 'new-contact', isNewContact: true, mostRecentActivityDate: '2030-01-01T00:00:00Z' },
      { id: 'invalid-activity', mostRecentActivityDate: 'not-a-date' },
    ])).toBeNull();
  });

  it('resolves most recent activity for ISO timestamps with timezone offsets', async () => {
    const logUtil = await loadLogUtil();
    const contacts = [
      {
        id: 2289883081,
        name: 'Da Prod',
        phone: '+17206789819',
        type: 'Person',
        createdDate: '2025-09-29T15:03:01+08:00',
        mostRecentActivityDate: '2025-11-06T16:07:22+08:00',
      },
      {
        id: 2412269808,
        name: 'Da Multi',
        phone: '+17206789819',
        type: 'Person',
        createdDate: '2026-07-03T14:37:11+08:00',
        mostRecentActivityDate: '2026-07-03T14:37:13+08:00',
      },
      {
        id: 'createNewContact',
        name: 'Create new contact...',
        isNewContact: true,
      },
    ];

    expect(logUtil.resolveMostRecentActivityContact(contacts)).toMatchObject({
      id: 2412269808,
      name: 'Da Multi',
    });
  });

  it('returns no conflict for manual logs and maps default message-log values', async () => {
    seedStorage({
      userSettings: {
        voicemailType: { value: 'VM' },
      },
    });
    const logUtil = await loadLogUtil();

    await expect(logUtil.getLogConflictInfo({
      platform: platform(),
      isAutoLog: false,
      contactInfo: [],
      logType: 'callLog',
      direction: 'Inbound',
    })).resolves.toEqual({
      hasConflict: false,
      autoSelectAdditionalSubmission: {},
      conflictType: 'No conflict',
    });

    await expect(logUtil.getLogConflictInfo({
      platform: {
        name: 'salesforce',
        page: {
          messageLog: {
            additionalFields: [
              {
                const: 'messageType',
                defaultSettingId: 'messageTypeSetting',
                defaultSettingValues: {
                  voicemail: { settingId: 'voicemailType' },
                },
              },
            ],
          },
        },
        settings: [
          {
            id: 'messageTypeSetting',
            items: [
              {
                id: 'voicemailType',
                defaultValue: 'VM',
              },
            ],
          },
        ],
      },
      isAutoLog: true,
      contactInfo: [
        {
          id: 'contact-1',
          additionalInfo: {
            messageType: 'ignored direct value',
          },
        },
      ],
      logType: 'messageLog',
      isVoicemail: true,
    })).resolves.toMatchObject({
      hasConflict: false,
      autoSelectAdditionalSubmission: {
        messageType: 'VM',
      },
    });
  });

  it('maps fax defaults by option title and requires manual disposition for disallowed message defaults', async () => {
    seedStorage({
      userSettings: {
        faxType: { value: 'Fax Follow Up' },
        messageType: { value: 'Custom message action' },
      },
    });
    const logUtil = await loadLogUtil();
    const messagePlatform = {
      name: 'salesforce',
      page: {
        messageLog: {
          additionalFields: [
            {
              const: 'messageType',
              defaultSettingId: 'messageTypeSetting',
              defaultSettingValues: {
                fax: { settingId: 'faxType' },
                message: { settingId: 'messageType' },
              },
              allowCustomValue: false,
            },
          ],
        },
      },
      settings: [
        {
          id: 'messageTypeSetting',
          items: [
            { id: 'faxType', defaultValue: 'Fax Follow Up' },
            { id: 'messageType', defaultValue: 'Custom message action' },
          ],
        },
      ],
    };

    await expect(logUtil.getLogConflictInfo({
      platform: messagePlatform,
      isAutoLog: true,
      contactInfo: [
        {
          id: 'contact-1',
          isNewContact: false,
          additionalInfo: {
            messageType: [
              { const: 'FAX', title: 'Fax Follow Up' },
              { const: 'OTHER', title: 'Other' },
            ],
          },
        },
      ],
      logType: 'messageLog',
      isFax: true,
    })).resolves.toMatchObject({
      hasConflict: false,
      autoSelectAdditionalSubmission: {
        messageType: 'FAX',
      },
      conflictType: 'No conflict',
    });

    await expect(logUtil.getLogConflictInfo({
      platform: messagePlatform,
      isAutoLog: true,
      contactInfo: [
        {
          id: 'contact-1',
          isNewContact: false,
          additionalInfo: {
            messageType: [
              { const: 'KNOWN', title: 'Known' },
              { const: 'OTHER', title: 'Other' },
            ],
          },
        },
      ],
      logType: 'messageLog',
    })).resolves.toMatchObject({
      hasConflict: false,
      requireManualDisposition: true,
      autoSelectAdditionalSubmission: {},
      conflictType: 'Disposition conflict',
    });
  });

  it('adds pending recordings and syncs ready recordings from RCAdapter', async () => {
    const logUtil = await loadLogUtil();
    await logUtil.addPendingRecordingSessionId({ sessionId: 'session-1' });
    await logUtil.addPendingRecordingSessionId({ sessionId: 'session-1' });
    vi.mocked(RCAdapter.getCallLog!).mockResolvedValueOnce({
      call: { sessionId: 'session-1' },
    });

    await logUtil.triggerPendingRecordingCheck({ serverUrl: 'https://server.example' });

    expect(logService.syncCallData).toHaveBeenCalledWith({
      serverUrl: 'https://server.example',
      dataBody: { call: { sessionId: 'session-1' } },
    });
    expect(readStorage().pendingRecordings).toEqual([]);
  });

  it('keeps pending recordings when none are ready and skips empty pending checks', async () => {
    const logUtil = await loadLogUtil();
    vi.mocked(RCAdapter.getCallLog!).mockClear();
    vi.mocked(logService.syncCallData).mockClear();

    await logUtil.triggerPendingRecordingCheck({ serverUrl: 'https://server.example' });
    expect(RCAdapter.getCallLog).not.toHaveBeenCalled();
    expect(logService.syncCallData).not.toHaveBeenCalled();

    seedStorage({
      pendingRecordings: ['session-pending'],
    });
    vi.mocked(RCAdapter.getCallLog!).mockResolvedValueOnce(null);

    await logUtil.triggerPendingRecordingCheck({ serverUrl: 'https://server.example' });

    expect(logService.syncCallData).not.toHaveBeenCalled();
    expect(readStorage().pendingRecordings).toEqual(['session-pending']);
  });

  it('removes pending recording ids using the current storage update behavior', async () => {
    seedStorage({
      pendingRecordings: ['session-1', 'session-2'],
    });
    const logUtil = await loadLogUtil();

    await logUtil.removePendingRecordingSessionId({ sessionId: 'session-1' });

    expect(readStorage().pendingRecordings).toEqual([]);
  });

  it('caches and returns log page data, resolving manifest and platform when missing', async () => {
    vi.mocked(getManifest).mockResolvedValue({ serverUrl: 'https://server.example' });
    vi.mocked(getPlatformInfo).mockResolvedValue({ platformName: 'salesforce' });
    const logUtil = await loadLogUtil();

    await logUtil.cacheLogPageData({
      id: 'page-1',
      logType: 'callLog',
      triggerType: 'manual',
      direction: 'Inbound',
      contactInfo: [],
      logInfo: { sessionId: 'session-1' },
      loggedContactId: 'contact-1',
    });

    await expect(logUtil.getCachedLogPageData()).resolves.toMatchObject({
      id: 'page-1',
      manifest: { serverUrl: 'https://server.example' },
      platformName: 'salesforce',
    });
  });

  it('caches log page data without resolving already provided manifest and platform', async () => {
    vi.mocked(getManifest).mockClear();
    vi.mocked(getPlatformInfo).mockClear();
    const logUtil = await loadLogUtil();

    await logUtil.cacheLogPageData({
      id: 'page-2',
      manifest: { serverUrl: 'https://provided.example' },
      logType: 'messageLog',
      triggerType: 'manual',
      platformName: 'salesforce',
      direction: '',
      contactInfo: [{ id: 'contact-1' }],
    });

    expect(getManifest).not.toHaveBeenCalled();
    expect(getPlatformInfo).not.toHaveBeenCalled();
    await expect(logUtil.getCachedLogPageData()).resolves.toMatchObject({
      id: 'page-2',
      manifest: { serverUrl: 'https://provided.example' },
      platformName: 'salesforce',
    });
  });
});
