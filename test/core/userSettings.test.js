import { loadModule } from '../helpers/loadModule';

let userCore;

beforeEach(async () => {
  vi.resetModules();
  userCore = await loadModule('../../src/core/user.js');
});

describe('user settings getters', () => {
  it('uses documented defaults for key feature toggles', () => {
    expect(userCore.getShowChatTabSetting({}).value).toBe(true);
    expect(userCore.getShowMeetingsTabSetting({}).value).toBe(true);
    expect(userCore.getShowTextTabSetting({}).value).toBe(true);
    expect(userCore.getShowFaxTabSetting({}).value).toBe(true);
    expect(userCore.getShowVoicemailTabSetting({}).value).toBe(true);
    expect(userCore.getShowRecordingsTabSetting({}).value).toBe(true);
    expect(userCore.getShowContactsTabSetting({}).value).toBe(true);
    expect(userCore.getShowCalldownTabSetting({}).value).toBe(true);
    expect(userCore.getShowAppointmentsTabSetting({}).value).toBe(true);
    expect(userCore.getC2DMatcherTypeSetting({}).value).toBe('libPhone');
    expect(userCore.getNotificationLevelSetting({}).value).toEqual(['success', 'warning', 'error']);
  });

  it('marks settings read-only when admin made them non-customizable', () => {
    expect(userCore.getAutoLogSMSSetting({
      autoLogSMS: {
        value: true,
        customizable: false,
      },
    })).toEqual({
      value: true,
      readOnly: true,
      readOnlyReason: 'This setting is managed by admin',
    });
  });

  it('disables client-side call auto-log when account server-side logging is enabled', () => {
    expect(userCore.getAutoLogCallSetting({
      autoLogCall: { value: true },
      serverSideLogging: {
        enable: true,
        loggingLevel: 'Account',
      },
    })).toEqual({
      value: false,
      readOnly: true,
      readOnlyReason: 'This cannot be turn ON becauase server side logging is enabled by admin',
      warning: 'Unavailable while server side call logging enabled',
    });
  });

  it('normalizes click-to-dial and quick access URL settings', () => {
    expect(userCore.getClickToDialEmbedMode({}).value).toBe('crmOnly');
    expect(userCore.getQuickAccessButtonEmbedMode({}).value).toBe('crmOnly');
    expect(userCore.getClickToDialUrls({ clickToDialUrls: { value: '' } }).value).toEqual([]);
    expect(userCore.getQuickAccessButtonUrls({ quickAccessButtonUrls: { value: ['https://crm.example/*'] } }).value)
      .toEqual(['https://crm.example/*']);
  });

  it('returns custom setting values, defaults, options, and read-only state', () => {
    expect(userCore.getCustomSetting({
      crmStage: {
        value: 'Demo',
        customizable: false,
        options: ['Demo', 'Closed'],
      },
    }, 'crmStage', 'Default')).toEqual({
      value: 'Demo',
      readOnly: true,
      readOnlyReason: 'This setting is managed by admin',
      options: ['Demo', 'Closed'],
    });

    expect(userCore.getCustomSetting({}, 'missing', 'Default')).toEqual({
      value: 'Default',
      readOnly: false,
      readOnlyReason: 'This setting is managed by admin',
      options: [],
    });
  });

  it('extracts active plugin settings and skips removed plugins', () => {
    const userSettings = {
      plugin_a: { value: { version: '1.0.0' } },
      plugin_b: { value: { version: '2.0.0' }, isRemoved: true },
      unrelated: { value: true },
    };

    expect(userCore.getAllPluginSettings(userSettings)).toEqual({
      a: { version: '1.0.0' },
    });
    expect(userCore.getPluginSetting(userSettings, 'a')).toEqual({ version: '1.0.0' });
  });

  it('returns defaults for logging, call pop, AI, report, appointment, and formatting settings', () => {
    const defaults = [
      ['getAutoLogVoicemailSetting', false],
      ['getAutoLogInboundFaxSetting', false],
      ['getAutoLogOutboundFaxSetting', false],
      ['getEnableRetroCallLogSync', true],
      ['getOneTimeLogSetting', false],
      ['getCallPopSetting', false],
      ['getSMSPopSetting', false],
      ['getIncomingCallPop', 'disabled'],
      ['getOutgoingCallPop', 'disabled'],
      ['getCallPopMultiMatchBehavior', 'promptToSelect'],
      ['getopenContactPageAfterCreationSetting', false],
      ['getDeveloperModeSetting', false],
      ['getAutoOpenSetting', false],
      ['getShowAiAssistantWidgetSetting', false],
      ['getAutoStartAiAssistantSetting', false],
      ['getShowUserReportTabSetting', true],
      ['getClickToDialEmbedMode', 'crmOnly'],
      ['getQuickAccessButtonEmbedMode', 'crmOnly'],
      ['getAddCallLogNoteSetting', true],
      ['getAddCallSessionIdSetting', false],
      ['getAddRingCentralUserNameSetting', false],
      ['getAddRingCentralNumberSetting', false],
      ['getAddCallLogSubjectSetting', true],
      ['getAddCallLogContactNumberSetting', true],
      ['getAddCallLogDateTimeSetting', true],
      ['getLogDateFormatSetting', 'YYYY-MM-DD hh:mm:ss A'],
      ['getAddCallLogDurationSetting', true],
      ['getAddCallLogResultSetting', true],
      ['getAddCallLogRecordingSetting', true],
      ['getAddCallLogAiNoteSetting', true],
      ['getAddCallLogTranscriptSetting', true],
      ['getUnknownContactPreferenceSetting', 'skipLogging'],
      ['getMultipleContactsPreferenceSetting', 'skipLogging'],
      ['getNewContactTypeSetting', null],
      ['getNewContactNamePrefixSetting', 'PlaceholderContact'],
      ['getPhoneNumberDisplayFormatTypeSetting', 'national'],
      ['getPhoneNumberDisplayFormatTemplateSetting', ''],
      ['getQuickAccessButtonSizeSetting', 'large'],
    ];

    for (const [getter, defaultValue] of defaults) {
      expect(userCore[getter]({}).value).toEqual(defaultValue);
    }
  });

  it('marks remaining getters read-only when managed by admin and preserves configured values', () => {
    const managedSettings = {
      autoLogVoicemail: { value: true, customizable: false },
      autoLogInboundFax: { value: true, customizable: false },
      autoLogOutboundFax: { value: true, customizable: false },
      enableRetroCallLogSync: { value: true, customizable: false },
      oneTimeLog: { value: true, customizable: false },
      popupLogPageAfterCall: { value: true, customizable: false },
      popupLogPageAfterSMS: { value: true, customizable: false },
      openContactPageFromIncomingCall: { value: 'onAnswer', customizable: false },
      openContactPageFromOutgoingCall: { value: 'onFirstRing', customizable: false },
      multiContactMatchBehavior: { value: 'openAllMatches', customizable: false },
      openContactPageAfterCreation: { value: true, customizable: false },
      developerMode: { value: true, customizable: false },
      autoOpenExtension: { value: true, customizable: false },
      showAiAssistantWidget: { value: true, customizable: false },
      autoStartAiAssistant: { value: true, customizable: false },
      showUserReportTab: { value: false, customizable: false },
      clickToDialEmbedMode: { value: 'blacklist', customizable: false },
      quickAccessButtonEmbedMode: { value: 'whitelist', customizable: false },
      addCallLogNote: { value: false, customizable: false },
      addCallSessionId: { value: true, customizable: false },
      addRingCentralUserName: { value: true, customizable: false },
      addRingCentralNumber: { value: true, customizable: false },
      addCallLogSubject: { value: false, customizable: false },
      addCallLogContactNumber: { value: false, customizable: false },
      addCallLogDateTime: { value: false, customizable: false },
      logDateFormat: { value: 'MM/DD/YYYY HH:mm:ss', customizable: false },
      addCallLogDuration: { value: false, customizable: false },
      addCallLogResult: { value: false, customizable: false },
      addCallLogRecording: { value: false, customizable: false },
      addCallLogAiNote: { value: false, customizable: false },
      addCallLogTranscript: { value: false, customizable: false },
      unknownContactPreference: { value: 'createNewPlaceholderContact', customizable: false },
      multipleContactsPreference: { value: 'firstAlphabetical', customizable: false },
      newContactType: { value: 'Lead', customizable: false },
      newContactNamePrefix: { value: 'Auto ', customizable: false },
      phoneNumberDisplayFormatType: { value: 'custom', customizable: false },
      phoneNumberDisplayFormatTemplate: { value: '(###) ###-####', customizable: false },
      quickAccessButtonSize: { value: 'small', customizable: false },
    };
    const expectations = [
      ['getAutoLogVoicemailSetting', true],
      ['getAutoLogInboundFaxSetting', true],
      ['getAutoLogOutboundFaxSetting', true],
      ['getEnableRetroCallLogSync', true],
      ['getOneTimeLogSetting', true],
      ['getCallPopSetting', true],
      ['getSMSPopSetting', true],
      ['getIncomingCallPop', 'onAnswer'],
      ['getOutgoingCallPop', 'onFirstRing'],
      ['getCallPopMultiMatchBehavior', 'openAllMatches'],
      ['getopenContactPageAfterCreationSetting', true],
      ['getDeveloperModeSetting', true],
      ['getAutoOpenSetting', true],
      ['getShowAiAssistantWidgetSetting', true],
      ['getAutoStartAiAssistantSetting', true],
      ['getShowUserReportTabSetting', false],
      ['getClickToDialEmbedMode', 'blacklist'],
      ['getQuickAccessButtonEmbedMode', 'whitelist'],
      ['getAddCallLogNoteSetting', false],
      ['getAddCallSessionIdSetting', true],
      ['getAddRingCentralUserNameSetting', true],
      ['getAddRingCentralNumberSetting', true],
      ['getAddCallLogSubjectSetting', false],
      ['getAddCallLogContactNumberSetting', false],
      ['getAddCallLogDateTimeSetting', false],
      ['getLogDateFormatSetting', 'MM/DD/YYYY HH:mm:ss'],
      ['getAddCallLogDurationSetting', false],
      ['getAddCallLogResultSetting', false],
      ['getAddCallLogRecordingSetting', false],
      ['getAddCallLogAiNoteSetting', false],
      ['getAddCallLogTranscriptSetting', false],
      ['getUnknownContactPreferenceSetting', 'createNewPlaceholderContact'],
      ['getMultipleContactsPreferenceSetting', 'firstAlphabetical'],
      ['getNewContactTypeSetting', 'Lead'],
      ['getNewContactNamePrefixSetting', 'Auto '],
      ['getPhoneNumberDisplayFormatTypeSetting', 'custom'],
      ['getPhoneNumberDisplayFormatTemplateSetting', '(###) ###-####'],
      ['getQuickAccessButtonSizeSetting', 'small'],
    ];

    for (const [getter, value] of expectations) {
      expect(userCore[getter](managedSettings)).toEqual({
        value,
        readOnly: true,
        readOnlyReason: 'This setting is managed by admin',
      });
    }
  });
});
