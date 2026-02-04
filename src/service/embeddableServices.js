import userCore from '../core/user';
import authCore from '../core/auth';
import { getPlatformInfo } from './platformService';
import { getManifest } from './manifestService';
import { t } from '../i18n';

async function preconfigureServiceManifest() {
    const manifest = await getManifest();
    const services = {
        name: 'placeholder',
        displayName: t('settings.preconfigure.noCrmSelected'),
        authorizationPath: '/platform-selection',
        authorizedTitle: t('settings.auth.authorizedTitle'),
        unauthorizedTitle: t('common.buttons.select'),
        showAuthRedDot: true,
        authorized: false,
        customizedPageInputChangedEventPath: '/customizedPage/inputChanged',
        buttonEventPath: '/custom-button-click'
    }
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-register-third-party-service',
        service: services
    }, '*');
}

async function getServiceManifest() {
    const { isAdmin } = await chrome.storage.local.get({ isAdmin: false });
    const { userSettings } = await chrome.storage.local.get({ userSettings: {} });
    const { userPermissions } = await chrome.storage.local.get({ userPermissions: {} });
    const { crmAuthed } = await chrome.storage.local.get({ crmAuthed: false });
    const { developerMode } = await chrome.storage.local.get({ developerMode: false });
    const { crmUserInfo } = (await chrome.storage.local.get({ crmUserInfo: null }));
    const platformInfo = await getPlatformInfo();
    const manifest = await getManifest();
    const platform = manifest.platforms[platformInfo.platformName];
    const platformName = platform.name;
    const customSettings = platform.settings;
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-set-phone-number-format',
        formatType: userCore.getPhoneNumberDisplayFormatTypeSetting(userSettings).value, // 'national', 'international', 'e164', 'custom'
        template: userCore.getPhoneNumberDisplayFormatTemplateSetting(userSettings).value, // required if 'custom' type, eg: '(###) ###-####'. use # and * to represent the digits. x represents masked digit
        readOnly: userCore.getPhoneNumberDisplayFormatTypeSetting(userSettings).readOnly, // optional, set to true to disable user change setting
        readOnlyReason: userCore.getPhoneNumberDisplayFormatTypeSetting(userSettings).readOnlyReason, // optional, set to true to disable user change setting
    }, '*');
    const services = {
        name: platformName,
        displayName: platform.displayName,
        customizedPageInputChangedEventPath: '/customizedPage/inputChanged',
        contactMatchPath: '/contacts/match',
        viewMatchedContactPath: '/contacts/view',
        // Where the embeddable will post button click events to
        buttonEventPath: '/custom-button-click',
        // Direct button registration (older/newer builds may read this)
        buttons: [
            { id: 'callLater', type: 'callAction', label: t('settings.buttons.callLater'), icon: 'calendar' },
            { id: 'callLaterInMessage', type: 'messageAction', label: t('settings.buttons.callLater'), icon: 'calendar' },
            { id: 'callLaterInContact', type: 'contactAction', label: t('settings.buttons.callLater'), icon: 'calendar' }
        ],
        contactMatchTtl: 7 * 24 * 60 * 60 * 1000, // contact match cache time in seconds, set as 7 days
        contactNoMatchTtl: 7 * 24 * 60 * 60 * 1000, // contact no match cache time in seconds, default is 5 minutes, from v1.10.2

        // show auth/unauth button in ringcentral widgets
        authorizationPath: '/authorize',
        authorizedTitle: t('settings.auth.authorizedTitle'),
        unauthorizedTitle: t('settings.auth.unauthorizedTitle'),
        authorizationLogo: platform?.logoUrl ?? '',
        showAuthRedDot: true,
        authorized: crmAuthed,
        authorizedAccount: `${crmUserInfo?.name ?? ''} ${isAdmin ? t('common.labels.admin') : ''}`,
        info: t('settings.auth.developedBy', { author: manifest?.author?.name ?? 'Unknown' }),

        // Enable call log sync feature
        callLoggerPath: '/callLogger',
        callLogPageInputChangedEventPath: '/callLogger/inputChanged',
        callLogEntityMatcherPath: '/callLogger/match',
        callLoggerHideEditLogButton: manifest.platforms[platformName].hideEditLogButton ?? false,

        messageLoggerPath: '/messageLogger',
        messagesLogPageInputChangedEventPath: '/messageLogger/inputChanged',
        messageLogEntityMatcherPath: '/messageLogger/match',
        messageLoggerAutoSettingLabel: t('settings.logging.autoLogSMS'),
        messageLoggerAutoSettingReadOnly: userCore.getAutoLogSMSSetting(userSettings).readOnly,
        messageLoggerAutoSettingReadOnlyReason: userCore.getAutoLogSMSSetting(userSettings).readOnlyReason,
        messageLoggerAutoSettingReadOnlyValue: userCore.getAutoLogSMSSetting(userSettings).value,

        callLoggerAutoLogSettingHidden: true,
        messageLoggerAutoSettingHidden: true,

        settingsPath: '/settings',
        settings: [
            {
                id: 'logging',
                type: 'group',
                name: t('settings.logging.groupName'),
                items: [
                    {
                        id: 'autoLogCall',
                        type: 'boolean',
                        name: t('settings.logging.autoLogCall'),
                        description: t('settings.logging.autoLogCallDesc'),
                        readOnly: userCore.getAutoLogCallSetting(userSettings, isAdmin).readOnly,
                        readOnlyReason: userCore.getAutoLogCallSetting(userSettings, isAdmin).warning ?? userCore.getAutoLogCallSetting(userSettings, isAdmin).readOnlyReason,
                        value: userCore.getAutoLogCallSetting(userSettings, isAdmin).value,
                    },
                    {
                        id: 'autoLogSMS',
                        type: 'boolean',
                        name: t('settings.logging.autoLogSMS'),
                        description: t('settings.logging.autoLogSMSDesc'),
                        readOnly: userCore.getAutoLogSMSSetting(userSettings).readOnly,
                        readOnlyReason: userCore.getAutoLogSMSSetting(userSettings).readOnlyReason,
                        value: userCore.getAutoLogSMSSetting(userSettings).value,
                    },
                    {
                        id: 'autoLogVoicemail',
                        type: 'boolean',
                        name: t('settings.logging.autoLogVoicemail'),
                        description: t('settings.logging.autoLogVoicemailDesc'),
                        readOnly: userCore.getAutoLogVoicemailSetting(userSettings).readOnly,
                        readOnlyReason: userCore.getAutoLogVoicemailSetting(userSettings).readOnlyReason,
                        value: userCore.getAutoLogVoicemailSetting(userSettings).value,
                    },
                    {
                        id: 'autoLogInboundFax',
                        type: 'boolean',
                        name: t('settings.logging.autoLogInboundFax'),
                        description: t('settings.logging.autoLogInboundFaxDesc'),
                        readOnly: userCore.getAutoLogInboundFaxSetting(userSettings).readOnly,
                        readOnlyReason: userCore.getAutoLogInboundFaxSetting(userSettings).readOnlyReason,
                        value: userCore.getAutoLogInboundFaxSetting(userSettings).value,
                    },
                    {
                        id: 'autoLogOutboundFax',
                        type: 'boolean',
                        name: t('settings.logging.autoLogOutboundFax'),
                        description: t('settings.logging.autoLogOutboundFaxDesc'),
                        readOnly: userCore.getAutoLogOutboundFaxSetting(userSettings).readOnly,
                        readOnlyReason: userCore.getAutoLogOutboundFaxSetting(userSettings).readOnlyReason,
                        value: userCore.getAutoLogOutboundFaxSetting(userSettings).value,
                    },
                    {
                        id: "enableRetroCallLogSync",
                        type: "boolean",
                        name: t('settings.logging.retroCallLogSync'),
                        description: t('settings.logging.retroCallLogSyncDesc'),
                        readOnly: userCore.getEnableRetroCallLogSync(userSettings).readOnly,
                        readOnlyReason: userCore.getEnableRetroCallLogSync(userSettings).readOnlyReason,
                        value: userCore.getEnableRetroCallLogSync(userSettings).value
                    },
                    {
                        id: "oneTimeLog",
                        type: "boolean",
                        name: t('settings.logging.oneTimeLog'),
                        description: t('settings.logging.oneTimeLogDesc'),
                        readOnly: userCore.getOneTimeLogSetting(userSettings).readOnly,
                        readOnlyReason: userCore.getOneTimeLogSetting(userSettings).readOnlyReason,
                        value: userCore.getOneTimeLogSetting(userSettings).value
                    },
                    {
                        id: "popupLogPageAfterCall",
                        type: "boolean",
                        name: t('settings.logging.popupLogPageAfterCall'),
                        description: t('settings.logging.popupLogPageAfterCallDesc'),
                        readOnly: userCore.getCallPopSetting(userSettings).readOnly,
                        readOnlyReason: userCore.getCallPopSetting(userSettings).readOnlyReason,
                        value: userCore.getCallPopSetting(userSettings).value
                    },
                    {
                        id: "popupLogPageAfterSMS",
                        type: "boolean",
                        name: t('settings.logging.popupLogPageAfterSMS'),
                        description: t('settings.logging.popupLogPageAfterSMSDesc'),
                        readOnly: userCore.getSMSPopSetting(userSettings).readOnly,
                        readOnlyReason: userCore.getSMSPopSetting(userSettings).readOnlyReason,
                        value: userCore.getSMSPopSetting(userSettings).value
                    }
                ]
            },
            {
                id: 'appearance',
                type: 'group',
                name: t('settings.appearance.groupName'),
                description: t('settings.appearance.groupDesc'),
                items: [
                    {
                        id: 'tabs',
                        type: 'section',
                        name: t('settings.appearance.customizeTabs'),
                        groupId: 'appearance',
                        description: t('settings.appearance.customizeTabsDesc'),
                        items: [
                            {
                                id: 'showChatTab',
                                type: 'boolean',
                                name: t('settings.appearance.showChatTab'),
                                value: userCore.getShowChatTabSetting(userSettings).value,
                                readOnly: userCore.getShowChatTabSetting(userSettings).readOnly,
                                readOnlyReason: userCore.getShowChatTabSetting(userSettings).readOnlyReason
                            },
                            {
                                id: 'showMeetingsTab',
                                type: 'boolean',
                                name: t('settings.appearance.showMeetingsTab'),
                                value: userCore.getShowMeetingsTabSetting(userSettings).value,
                                readOnly: userCore.getShowMeetingsTabSetting(userSettings).readOnly,
                                readOnlyReason: userCore.getShowMeetingsTabSetting(userSettings).readOnlyReason
                            },
                            {
                                id: 'showTextTab',
                                type: 'boolean',
                                name: t('settings.appearance.showTextTab'),
                                value: userCore.getShowTextTabSetting(userSettings).value,
                                readOnly: userCore.getShowTextTabSetting(userSettings).readOnly,
                                readOnlyReason: userCore.getShowTextTabSetting(userSettings).readOnlyReason
                            },
                            {
                                id: 'showFaxTab',
                                type: 'boolean',
                                name: t('settings.appearance.showFaxTab'),
                                value: userCore.getShowFaxTabSetting(userSettings).value,
                                readOnly: userCore.getShowFaxTabSetting(userSettings).readOnly,
                                readOnlyReason: userCore.getShowFaxTabSetting(userSettings).readOnlyReason
                            },
                            {
                                id: 'showVoicemailTab',
                                type: 'boolean',
                                name: t('settings.appearance.showVoicemailTab'),
                                value: userCore.getShowVoicemailTabSetting(userSettings).value,
                                readOnly: userCore.getShowVoicemailTabSetting(userSettings).readOnly,
                                readOnlyReason: userCore.getShowVoicemailTabSetting(userSettings).readOnlyReason
                            },
                            {
                                id: 'showRecordingsTab',
                                type: 'boolean',
                                name: t('settings.appearance.showRecordingsTab'),
                                value: userCore.getShowRecordingsTabSetting(userSettings).value,
                                readOnly: userCore.getShowRecordingsTabSetting(userSettings).readOnly,
                                readOnlyReason: userCore.getShowRecordingsTabSetting(userSettings).readOnlyReason
                            },
                            {
                                id: 'showContactsTab',
                                type: 'boolean',
                                name: t('settings.appearance.showContactsTab'),
                                value: userCore.getShowContactsTabSetting(userSettings).value,
                                readOnly: userCore.getShowContactsTabSetting(userSettings).readOnly,
                                readOnlyReason: userCore.getShowContactsTabSetting(userSettings).readOnlyReason
                            },
                            {
                                id: 'showUserReportTab',
                                type: 'boolean',
                                name: t('settings.appearance.showUserReportTab'),
                                value: userCore.getShowUserReportTabSetting(userSettings).value,
                                readOnly: userCore.getShowUserReportTabSetting(userSettings).readOnly,
                                readOnlyReason: userCore.getShowUserReportTabSetting(userSettings).readOnlyReason
                            },
                            {
                                id: 'showCalldownTab',
                                type: 'boolean',
                                name: t('settings.appearance.showCalldownTab'),
                                value: userCore.getShowCalldownTabSetting(userSettings).value,
                                readOnly: userCore.getShowCalldownTabSetting(userSettings).readOnly,
                                readOnlyReason: userCore.getShowCalldownTabSetting(userSettings).readOnlyReason
                            }
                        ]
                    },
                    {
                        id: 'notificationLevel',
                        type: 'section',
                        name: t('settings.appearance.notificationLevel'),
                        groupId: 'appearance',
                        description: t('settings.appearance.notificationLevelSelectDesc'),
                        items: [
                            {
                                id: 'notificationLevelSetting',
                                type: 'option',
                                name: t('settings.appearance.notificationLevel'),
                                description: t('settings.appearance.notificationLevelDesc'),
                                multiple: true,
                                checkbox: true,
                                options: [
                                    {
                                        id: 'success',
                                        name: t('settings.appearance.success')
                                    },
                                    {
                                        id: 'warning',
                                        name: t('settings.appearance.warning')
                                    },
                                    {
                                        id: 'error',
                                        name: t('settings.appearance.error')
                                    }
                                ],
                                value: userCore.getNotificationLevelSetting(userSettings).value,
                                readOnly: userCore.getNotificationLevelSetting(userSettings).readOnly,
                                readOnlyReason: userCore.getNotificationLevelSetting(userSettings).readOnlyReason
                            }
                        ]
                    },
                    {
                        id: 'widgetSettings',
                        type: 'section',
                        name: t('settings.appearance.widgetSettings'),
                        groupId: 'appearance',
                        description: t('settings.appearance.widgetSettingsDesc'),
                        items: [
                            {
                                id: 'quickAccessButtonSize',
                                type: 'option',
                                name: t('settings.appearance.quickAccessButtonSize'),
                                options: [
                                    { id: 'small', name: t('settings.appearance.small') },
                                    { id: 'medium', name: t('settings.appearance.medium') },
                                    { id: 'large', name: t('settings.appearance.large') },
                                    { id: 'xlarge', name: t('settings.appearance.extraLarge') }
                                ],
                                value: userCore.getQuickAccessButtonSizeSetting(userSettings).value,
                                readOnly: userCore.getQuickAccessButtonSizeSetting(userSettings).readOnly,
                                readOnlyReason: userCore.getQuickAccessButtonSizeSetting(userSettings).readOnlyReason
                            }
                        ]
                    }
                ]
            },
            {
                id: 'contacts',
                type: 'section',
                name: t('settings.callPop.groupName'),
                items: [
                    {
                        id: 'openContactPageFromIncomingCall',
                        type: 'option',
                        name: t('settings.callPop.incomingCallPop'),
                        helper: t('settings.callPop.incomingCallPopHelper'),
                        options: [
                            {
                                id: 'disabled',
                                name: t('common.labels.disabled')
                            },
                            {
                                id: 'onFirstRing',
                                name: t('settings.callPop.onFirstRing')
                            },
                            {
                                id: 'onAnswer',
                                name: t('settings.callPop.onAnswer')
                            }
                        ],
                        value: userCore.getIncomingCallPop(userSettings).value,
                        readOnly: userCore.getIncomingCallPop(userSettings).readOnly,
                        readOnlyReason: userCore.getIncomingCallPop(userSettings).readOnlyReason,
                    },
                    {
                        id: 'openContactPageFromOutgoingCall',
                        type: 'option',
                        name: t('settings.callPop.outgoingCallPop'),
                        helper: t('settings.callPop.outgoingCallPopHelper'),
                        options: [
                            {
                                id: 'disabled',
                                name: t('common.labels.disabled')
                            },
                            {
                                id: 'onFirstRing',
                                name: t('settings.callPop.onFirstRing')
                            },
                            {
                                id: 'onAnswer',
                                name: t('settings.callPop.onAnswer')
                            }
                        ],
                        value: userCore.getOutgoingCallPop(userSettings).value,
                        readOnly: userCore.getOutgoingCallPop(userSettings).readOnly,
                        readOnlyReason: userCore.getOutgoingCallPop(userSettings).readOnlyReason
                    },
                    {
                        id: 'multiContactMatchBehavior',
                        type: 'option',
                        name: t('settings.callPop.multiContactBehavior'),
                        helper: t('settings.callPop.multiContactBehaviorHelper'),
                        options: platform?.name != 'bullhorn' ?
                            [
                                {
                                    id: 'disabled',
                                    name: t('common.labels.disabled')
                                },
                                {
                                    id: 'openAllMatches',
                                    name: t('settings.callPop.openAllMatches')
                                },
                                {
                                    id: 'promptToSelect',
                                    name: t('settings.callPop.promptToSelect')
                                }
                            ] :
                            [
                                {
                                    id: 'disabled',
                                    name: t('common.labels.disabled')
                                },
                                {
                                    id: 'promptToSelect',
                                    name: t('settings.callPop.promptToSelect')
                                }
                            ],
                        // Hack: Bullhorn doesn't have open all option
                        value: userCore.getCallPopMultiMatchBehavior(userSettings, platform?.name == 'bullhorn' && userSettings?.multiContactMatchBehavior?.value == 'openAllMatches').value,
                        readOnly: userCore.getCallPopMultiMatchBehavior(userSettings).readOnly,
                        readOnlyReason: userCore.getCallPopMultiMatchBehavior(userSettings).readOnlyReason,
                    },
                    ...(platform.enableExtensionNumberLoggingSetting ?
                        [{
                            id: 'allowExtensionNumberLogging',
                            type: 'boolean',
                            name: t('settings.callPop.allowExtensionLogging'),
                            value: userSettings?.allowExtensionNumberLogging?.value ?? false,
                            readOnly: userSettings?.allowExtensionNumberLogging?.customizable === undefined ? false : !userSettings?.allowExtensionNumberLogging?.customizable,
                            readOnlyReason: t('settings.callPop.managedByAdmin')
                        }] : []),
                    {
                        id: 'openContactPageAfterCreation',
                        type: 'boolean',
                        name: t('settings.callPop.contactCreatedCallPop'),
                        description: t('settings.callPop.contactCreatedCallPopDesc'),
                        value: userCore.getOpenContactAfterCreationSetting(userSettings).value,
                        readOnly: userCore.getOpenContactAfterCreationSetting(userSettings).readOnly,
                        readOnlyReason: userCore.getOpenContactAfterCreationSetting(userSettings).readOnlyReason
                    }
                ]
            },
            {
                id: "openInstalledProcessorListPage",
                type: "button",
                name: "Processor",
                buttonLabel: "Open",
                buttonType: "link",
            },
            {
                id: "openSupportPage",
                type: "button",
                name: t('pages.support.title'),
                buttonLabel: t('common.buttons.open'),
                buttonType: "link",
            },
            {
                id: "openAboutPage",
                type: "button",
                name: t('pages.about.title'),
                buttonLabel: t('common.buttons.open'),
                buttonType: "link",
            },
            {
                id: "advancedFeatures",
                type: "group",
                name: t('settings.advanced.groupName'),
                items: [
                    {
                        id: 'developerMode',
                        type: 'boolean',
                        name: t('settings.advanced.developerMode'),
                        description: t('settings.advanced.developerModeDesc'),
                        value: userCore.getDeveloperModeSetting(userSettings, developerMode).value,
                        readOnly: userCore.getDeveloperModeSetting(userSettings).readOnly,
                        readOnlyReason: userCore.getDeveloperModeSetting(userSettings).readOnlyReason
                    },
                    {
                        id: 'autoOpenExtension',
                        type: 'boolean',
                        name: t('settings.advanced.autoOpenExtension'),
                        description: t('settings.advanced.autoOpenExtensionDesc'),
                        value: userCore.getAutoOpenSetting(userSettings).value,
                        readOnly: userCore.getAutoOpenSetting(userSettings).readOnly,
                        readOnlyReason: userCore.getAutoOpenSetting(userSettings).readOnlyReason
                    }
                ]
            }
        ]
    }

    if (platform.useLicense) {
        const licenseStatusResponse = await authCore.getLicenseStatus({ serverUrl: manifest.serverUrl });
        services.licenseStatus = `License: ${licenseStatusResponse.licenseStatus}`;
        services.licenseStatusColor = licenseStatusResponse.licenseStatusColor;
        services.licenseDescription = licenseStatusResponse.licenseStatusDescription;
    }
    services.settings.push(
        {
            id: 'clickToDialEmbed',
            type: 'section',
            name: t('settings.enabledDomains.groupName'),
            groupId: 'general',
            description: t('settings.enabledDomains.groupDesc'),
            items: [
                {
                    id: 'clickToDialEmbedWarning',
                    name: t('common.labels.warning'),
                    type: 'admonition',
                    severity: 'warning',
                    value: t('settings.enabledDomains.clickToDialWarning')
                },
                {
                    id: 'clickToDialEmbedMode',
                    type: 'option',
                    name: t('settings.enabledDomains.clickToDialMode'),
                    options: [
                        {
                            id: 'disabled',
                            name: t('common.labels.disabled')
                        },
                        {
                            id: 'crmOnly',
                            name: t('settings.enabledDomains.crmOnly')
                        },
                        {
                            id: 'whitelist',
                            name: t('settings.enabledDomains.whitelist')
                        },
                        {
                            id: 'blacklist',
                            name: t('settings.enabledDomains.blacklist')
                        }
                    ],
                    value: userCore.getClickToDialEmbedMode(userSettings).value,
                    readOnly: userCore.getClickToDialEmbedMode(userSettings).readOnly,
                    readOnlyReason: userCore.getClickToDialEmbedMode(userSettings).readOnlyReason
                },
                {
                    id: 'clickToDialUrls',
                    type: 'array',
                    name: t('settings.enabledDomains.clickToDialUrls'),
                    helper: t('settings.enabledDomains.clickToDialUrlsHelper'),
                    value: userCore.getClickToDialUrls(userSettings).value,
                    readOnly: userCore.getClickToDialUrls(userSettings).readOnly,
                    readOnlyReason: userCore.getClickToDialUrls(userSettings).readOnlyReason
                },
                {
                    id: 'quickAccessButtonEmbedWarning',
                    name: t('common.labels.warning'),
                    type: 'admonition',
                    severity: 'warning',
                    value: t('settings.enabledDomains.quickAccessWarning')
                },
                {
                    id: 'quickAccessButtonEmbedMode',
                    type: 'option',
                    name: t('settings.enabledDomains.quickAccessMode'),
                    options: [
                        {
                            id: 'disabled',
                            name: t('common.labels.disabled')
                        },
                        {
                            id: 'crmOnly',
                            name: t('settings.enabledDomains.crmOnly')
                        },
                        {
                            id: 'whitelist',
                            name: t('settings.enabledDomains.whitelist')
                        },
                        {
                            id: 'blacklist',
                            name: t('settings.enabledDomains.blacklist')
                        }
                    ],
                    value: userCore.getQuickAccessButtonEmbedMode(userSettings).value,
                    readOnly: userCore.getQuickAccessButtonEmbedMode(userSettings).readOnly,
                    readOnlyReason: userCore.getQuickAccessButtonEmbedMode(userSettings).readOnlyReason
                },
                {
                    id: 'quickAccessButtonUrls',
                    type: 'array',
                    name: t('settings.enabledDomains.quickAccessUrls'),
                    helper: t('settings.enabledDomains.clickToDialUrlsHelper'),
                    value: userCore.getQuickAccessButtonUrls(userSettings).value,
                    readOnly: userCore.getQuickAccessButtonUrls(userSettings).readOnly,
                    readOnlyReason: userCore.getQuickAccessButtonUrls(userSettings).readOnlyReason
                }
            ]
        }
    );
    services.settings.push({
        id: "callLogDetails",
        type: "section",
        name: t('settings.callLogDetails.groupName'),
        groupId: "logging",
        items: [
            {
                id: "addCallLogNote",
                type: "boolean",
                name: t('settings.callLogDetails.agentNotes'),
                description: t('settings.callLogDetails.agentNotesDesc'),
                value: userCore.getAddCallLogNoteSetting(userSettings).value,
                readOnly: userCore.getAddCallLogNoteSetting(userSettings).readOnly,
                readOnlyReason: userCore.getAddCallLogNoteSetting(userSettings).readOnlyReason
            },
            {
                id: "addCallSessionId",
                type: "boolean",
                name: t('settings.callLogDetails.callSessionId'),
                description: t('settings.callLogDetails.callSessionIdDesc'),
                value: userCore.getAddCallSessionIdSetting(userSettings).value,
                readOnly: userCore.getAddCallSessionIdSetting(userSettings).readOnly,
                readOnlyReason: userCore.getAddCallSessionIdSetting(userSettings).readOnlyReason
            },
            {
                id: "addRingCentralUserName",
                type: "boolean",
                name: t('settings.callLogDetails.rcUserName'),
                description: t('settings.callLogDetails.rcUserNameDesc'),
                value: userCore.getAddRingCentralUserNameSetting(userSettings).value,
                readOnly: userCore.getAddRingCentralUserNameSetting(userSettings).readOnly,
                readOnlyReason: userCore.getAddRingCentralUserNameSetting(userSettings).readOnlyReason
            },
            {
                id: "addRingCentralNumber",
                type: "boolean",
                name: t('settings.callLogDetails.rcNumber'),
                description: t('settings.callLogDetails.rcNumberDesc'),
                value: userCore.getAddRingCentralNumberSetting(userSettings).value,
                readOnly: userCore.getAddRingCentralNumberSetting(userSettings).readOnly,
                readOnlyReason: userCore.getAddRingCentralNumberSetting(userSettings).readOnlyReason
            },
            {
                id: "addCallLogSubject",
                type: "boolean",
                name: t('settings.callLogDetails.callSubject'),
                description: t('settings.callLogDetails.callSubjectDesc'),
                value: userCore.getAddCallLogSubjectSetting(userSettings).value,
                readOnly: userCore.getAddCallLogSubjectSetting(userSettings).readOnly,
                readOnlyReason: userCore.getAddCallLogSubjectSetting(userSettings).readOnlyReason
            },
            {
                id: "addCallLogContactNumber",
                type: "boolean",
                name: t('settings.callLogDetails.contactNumber'),
                description: t('settings.callLogDetails.contactNumberDesc'),
                value: userCore.getAddCallLogContactNumberSetting(userSettings).value,
                readOnly: userCore.getAddCallLogContactNumberSetting(userSettings).readOnly,
                readOnlyReason: userCore.getAddCallLogContactNumberSetting(userSettings).readOnlyReason
            },
            {
                id: "addCallLogDateTime",
                type: "boolean",
                name: t('settings.callLogDetails.dateTime'),
                description: t('settings.callLogDetails.dateTimeDesc'),
                value: userCore.getAddCallLogDateTimeSetting(userSettings).value,
                readOnly: userCore.getAddCallLogDateTimeSetting(userSettings).readOnly,
                readOnlyReason: userCore.getAddCallLogDateTimeSetting(userSettings).readOnlyReason
            },
            {
                id: "logDateFormat",
                type: "option",
                name: t('settings.callLogDetails.dateFormat'),
                description: t('settings.callLogDetails.dateFormatDesc'),
                options: [
                    // ISO 8601 and Standard Formats
                    {
                        id: "YYYY-MM-DD hh:mm:ss A",
                        name: t('dateFormats.general12H')
                    },
                    {
                        id: "YYYY-MM-DD HH:mm:ss",
                        name: t('dateFormats.general24H')
                    },
                    // US Formats
                    {
                        id: "MM/DD/YYYY hh:mm:ss A",
                        name: t('dateFormats.us12H')
                    },
                    {
                        id: "MM/DD/YYYY HH:mm:ss",
                        name: t('dateFormats.us24H')
                    },
                    // European Formats
                    {
                        id: "DD/MM/YYYY hh:mm:ss A",
                        name: t('dateFormats.eu12H')
                    },
                    {
                        id: "DD/MM/YYYY HH:mm:ss",
                        name: t('dateFormats.eu24H')
                    }
                ],
                value: userCore.getLogDateFormatSetting(userSettings).value,
                readOnly: userCore.getLogDateFormatSetting(userSettings).readOnly,
                readOnlyReason: userCore.getLogDateFormatSetting(userSettings).readOnlyReason
            },
            {
                id: "addCallLogDuration",
                type: "boolean",
                name: t('settings.callLogDetails.callDuration'),
                description: t('settings.callLogDetails.callDurationDesc'),
                value: userCore.getAddCallLogDurationSetting(userSettings).value,
                readOnly: userCore.getAddCallLogDurationSetting(userSettings).readOnly,
                readOnlyReason: userCore.getAddCallLogDurationSetting(userSettings).readOnlyReason
            },
            {
                id: "addCallLogResult",
                type: "boolean",
                name: t('settings.callLogDetails.callResult'),
                description: t('settings.callLogDetails.callResultDesc'),
                value: userCore.getAddCallLogResultSetting(userSettings).value,
                readOnly: userCore.getAddCallLogResultSetting(userSettings).readOnly,
                readOnlyReason: userCore.getAddCallLogResultSetting(userSettings).readOnlyReason
            },
            {
                id: "addCallLogRecording",
                type: "boolean",
                name: t('settings.callLogDetails.recordingLink'),
                description: t('settings.callLogDetails.recordingLinkDesc'),
                value: userCore.getAddCallLogRecordingSetting(userSettings).value,
                readOnly: userCore.getAddCallLogRecordingSetting(userSettings).readOnly,
                readOnlyReason: userCore.getAddCallLogRecordingSetting(userSettings).readOnlyReason
            },
            {
                id: "addCallLogAiNote",
                type: "boolean",
                name: t('settings.callLogDetails.smartSummary'),
                description: t('settings.callLogDetails.smartSummaryDesc'),
                value: userCore.getAddCallLogAiNoteSetting(userSettings).value,
                readOnly: userCore.getAddCallLogAiNoteSetting(userSettings).readOnly,
                readOnlyReason: userCore.getAddCallLogAiNoteSetting(userSettings).readOnlyReason
            },
            {
                id: "addCallLogTranscript",
                type: "boolean",
                name: t('settings.callLogDetails.transcript'),
                description: t('settings.callLogDetails.transcriptDesc'),
                value: userCore.getAddCallLogTranscriptSetting(userSettings).value,
                readOnly: userCore.getAddCallLogTranscriptSetting(userSettings).readOnly,
                readOnlyReason: userCore.getAddCallLogTranscriptSetting(userSettings).readOnlyReason
            }
        ],
    });
    services.settings.push({
        id: "autoLogPreferences",
        type: "section",
        name: t('settings.autoLogPreferences.groupName'),
        description: t('settings.autoLogPreferences.groupDesc'),
        groupId: "logging",
        items: [
            {
                id: "unknownContactPreference",
                type: "option",
                name: t('settings.autoLogPreferences.unknownContact'),
                helper: t('settings.autoLogPreferences.unknownContactHelper'),
                options: [
                    {
                        id: "skipLogging",
                        name: t('settings.autoLogPreferences.skipLogging')
                    },
                    {
                        id: "createNewPlaceholderContact",
                        name: t('settings.autoLogPreferences.createNewPlaceholder')
                    }
                ],
                value: userCore.getUnknownContactPreferenceSetting(userSettings).value,
                readOnly: userCore.getUnknownContactPreferenceSetting(userSettings).readOnly,
                readOnlyReason: userCore.getUnknownContactPreferenceSetting(userSettings).readOnlyReason
            },
            {
                id: "newContactType",
                type: "option",
                name: t('settings.autoLogPreferences.newContactType'),
                helper: t('settings.autoLogPreferences.newContactTypeHelper'),
                options: (platform.contactTypes && platform.contactTypes.length) > 0 ?
                    platform.contactTypes.map(contactType => ({
                        id: contactType.value,
                        name: contactType.display
                    })) : [{
                        id: "contact",
                        name: t('common.labels.contact')
                    }],
                value: (() => {
                    const userPreferredValue = userCore.getNewContactTypeSetting(userSettings, platform.contactTypes).value;
                    // Check if the user's preferred value exists in platform.contactTypes
                    if (userPreferredValue && platform?.contactTypes?.some(contactType => contactType.value === userPreferredValue)) {
                        return userPreferredValue;
                    }
                    // Fall back to first available contact type or default
                    return platform?.contactTypes?.[0]?.value || 'contact';
                })(),
                readOnly: userCore.getNewContactTypeSetting(userSettings, platform.contactTypes).readOnly,
                readOnlyReason: userCore.getNewContactTypeSetting(userSettings, platform.contactTypes).readOnlyReason
            },
            {
                id: "newContactNamePrefix",
                type: "string",
                name: t('settings.autoLogPreferences.newContactNamePrefix'),
                helper: t('settings.autoLogPreferences.newContactNamePrefixHelper'),
                value: userCore.getNewContactNamePrefixSetting(userSettings).value,
                readOnly: userCore.getNewContactNamePrefixSetting(userSettings).readOnly,
                readOnlyReason: userCore.getNewContactNamePrefixSetting(userSettings).readOnlyReason
            },
            {
                id: "multipleContactsPreference",
                type: "option",
                name: t('settings.autoLogPreferences.multipleContacts'),
                helper: t('settings.autoLogPreferences.multipleContactsHelper'),
                options: [
                    {
                        id: "skipLogging",
                        name: t('settings.autoLogPreferences.skipLogging')
                    },
                    {
                        id: "firstAlphabetical",
                        name: t('settings.autoLogPreferences.firstAlphabetical')
                    },
                    {
                        id: "mostRecentActivity",
                        name: t('settings.autoLogPreferences.mostRecentActivity')
                    }
                ],
                value: userCore.getMultipleContactsPreferenceSetting(userSettings).value,
                readOnly: userCore.getMultipleContactsPreferenceSetting(userSettings).readOnly,
                readOnlyReason: userCore.getMultipleContactsPreferenceSetting(userSettings).readOnlyReason
            }
        ]
    })
    if (customSettings) {
        for (const cs of customSettings) {
            // TEMP: skip custom settings for call log details
            if (cs.items.some(c => c.id === 'addCallLogNote' || c.id === 'addCallSessionId' || c.id === 'addCallLogSubject' || c.id === 'addCallLogContactNumber' || c.id === 'addCallLogDateTime' || c.id === 'addCallLogDuration' || c.id === 'addCallLogResult' || c.id === 'addCallLogRecording' || c.id === 'addCallLogAiNote' || c.id === 'addCallLogTranscript')) {
                continue;
            }
            const items = [];
            for (const item of cs.items) {
                if (item.requiredPermission && !userPermissions[item.requiredPermission]) {
                    continue;
                }
                switch (item.type) {
                    case 'inputField':
                        items.push({
                            id: item.id,
                            type: 'string',
                            name: item.name,
                            description: item.description,
                            placeHolder: item.placeHolder ?? "",
                            value: userCore.getCustomSetting(userSettings, item.id, item.defaultValue).value,
                            readOnly: userCore.getCustomSetting(userSettings, item.id, item.defaultValue).readOnly,
                            readOnlyReason: userCore.getCustomSetting(userSettings, item.id, item.defaultValue).readOnlyReason
                        });
                        break;
                    case 'boolean':
                        items.push({
                            id: item.id,
                            type: item.type,
                            name: item.name,
                            description: item.description,
                            value: userCore.getCustomSetting(userSettings, item.id, item.defaultValue).value,
                            readOnly: userCore.getCustomSetting(userSettings, item.id, item.defaultValue).readOnly,
                            readOnlyReason: userCore.getCustomSetting(userSettings, item.id, item.defaultValue).readOnlyReason
                        });
                        break;
                    case 'warning':
                        items.push(
                            {
                                id: item.id,
                                name: item.name,
                                type: 'admonition',
                                severity: 'warning',
                                value: item.value
                            }
                        )
                        break;
                    case 'option':
                        items.push(
                            {
                                id: item.id,
                                type: "option",
                                name: item.name,
                                description: item.description,
                                options: item.dynamicOptions ? userCore.getCustomSetting(userSettings, item.id, item.defaultValue).options : item.options,
                                multiple: item.multiple ?? false,
                                checkbox: item.checkbox ?? false,
                                required: item.required ?? false,
                                value: userCore.getCustomSetting(userSettings, item.id, item.defaultValue).value ?? (item.multiple ? [] : ""),
                                readOnly: userCore.getCustomSetting(userSettings, item.id, item.defaultValue).readOnly,
                                readOnlyReason: userCore.getCustomSetting(userSettings, item.id, item.defaultValue).readOnlyReason
                            }
                        )
                        break;
                    case 'button':
                        items.push(
                            {
                                id: item.id,
                                type: 'button',
                                name: item.name,
                                buttonLabel: item.buttonLabel || 'Open',
                                buttonType: item.buttonType || 'button'
                            }
                        )
                        break;
                }
            }
            const group = {
                id: cs.id,
                type: cs.type,
                name: cs.name,
                items
            };
            if (cs.group) {
                group.groupId = cs.group;
            }
            services.settings.splice(1, 0, group);
        }
    };
    if (platformName === 'clio' || platformName === 'insightly' || platformName === 'netsuite') {
        const numberFormatterComponent = [
            {
                id: "info",
                name: "info",
                type: "admonition",
                severity: "warning",
                value: t('settings.numberFormatter.info'),
            },
            {
                id: "overridingPhoneNumberFormat",
                name: t('settings.numberFormatter.format1'),
                type: "string",
                value: userSettings?.overridingPhoneNumberFormat?.value ?? "",
                readOnly: userSettings?.overridingPhoneNumberFormat?.customizable === undefined ? false : !userSettings?.overridingPhoneNumberFormat?.customizable,
                readOnlyReason: !userSettings?.overridingPhoneNumberFormat?.customizable ? t('settings.callPop.managedByAdmin') : ''
            },
            {
                id: "overridingPhoneNumberFormat2",
                name: t('settings.numberFormatter.format2'),
                type: "string",
                value: userSettings?.overridingPhoneNumberFormat2?.value ?? "",
                readOnly: userSettings?.overridingPhoneNumberFormat2?.customizable === undefined ? false : !userSettings?.overridingPhoneNumberFormat2?.customizable,
                readOnlyReason: !userSettings?.overridingPhoneNumberFormat2?.customizable ? t('settings.callPop.managedByAdmin') : ''
            },
            {
                id: "overridingPhoneNumberFormat3",
                name: t('settings.numberFormatter.format3'),
                type: "string",
                value: userSettings?.overridingPhoneNumberFormat3?.value ?? "",
                readOnly: userSettings?.overridingPhoneNumberFormat3?.customizable === undefined ? false : !userSettings?.overridingPhoneNumberFormat3?.customizable,
                readOnlyReason: !userSettings?.overridingPhoneNumberFormat3?.customizable ? t('settings.callPop.managedByAdmin') : ''
            }
        ]
        const optionSectionName = platform.name + "Options";
        services.settings.find(s => s.id === optionSectionName).items.push(
            {
                id: "numberFormatterTitle",
                name: t('settings.numberFormatter.title'),
                type: "typography",
                variant: "title2",
                value: t('settings.numberFormatter.phoneNumberAlternatives'),
            });
        services.settings.find(s => s.id === optionSectionName).items.push(...numberFormatterComponent);
    }
    if (platformName === 'googleSheets') {
        services.settings.unshift(
            {
                id: 'googleSheetsConfig',
                type: 'button',
                name: t('settings.googleSheets.config'),
                buttonLabel: t('common.buttons.open'),
                buttonType: 'link',
            }
        )
    }

    if (userCore.getDeveloperModeSetting(userSettings, developerMode).value) {
        services.settings.push(
            {
                id: 'openDeveloperSettingsPage',
                type: 'button',
                name: t('pages.developerSettings.title'),
                buttonLabel: t('common.buttons.open'),
                buttonType: "link",
            }
        )
    }
    // TEMP: add banner for webinar info
    const dateNow = new Date();
    const { myBannerDismissedDate } = await chrome.storage.local.get({ myBannerDismissedDate: 0 });
    if (dateNow.getFullYear() === 2026 && dateNow.getMonth() === 0 && dateNow.getDate() <= 29 && dateNow.getDate() > myBannerDismissedDate) {
        services.banner = {
            id: 'temp-webinar-banner',
            message: '[Learn about App Connect 2.0](https://go.ringcentral.com/Unlock-the-next-version-of-App-Connect.html?BMID=PENDOCCOAPPCONNECT2026)',
            severity: 'announcement',  // 'info' | 'warning' | 'error' | 'success' | 'announcement', default: 'info'
            closable: true, // optional, show close button, default: false, only works if no action button is provided
            closeButtonLabel: 'Close' // optional, close button label, default: 'Close'
        }
    }
    return services;
}

exports.preconfigureServiceManifest = preconfigureServiceManifest;
exports.getServiceManifest = getServiceManifest;