import userCore from '../core/user';
import { getPlatformInfo, getManifest } from '../lib/util';

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
    const services = {
        name: platformName,
        displayName: platform.displayName,
        customizedPageInputChangedEventPath: '/customizedPage/inputChanged',
        contactMatchPath: '/contacts/match',
        viewMatchedContactPath: '/contacts/view',
        contactMatchTtl: 7 * 24 * 60 * 60 * 1000, // contact match cache time in seconds, set as 7 days
        contactNoMatchTtl: 7 * 24 * 60 * 60 * 1000, // contact no match cache time in seconds, default is 5 minutes, from v1.10.2

        // show auth/unauth button in ringcentral widgets
        authorizationPath: '/authorize',
        authorizedTitle: 'Logout',
        unauthorizedTitle: 'Connect',
        authorizationLogo: platform?.logoUrl ?? '',
        showAuthRedDot: true,
        authorized: crmAuthed,
        authorizedAccount: `${crmUserInfo?.name ?? ''} (Admin)`,
        info: `Developed by ${manifest?.author?.name ?? 'Unknown'}`,

        // Enable call log sync feature
        callLoggerPath: '/callLogger',
        callLogPageInputChangedEventPath: '/callLogger/inputChanged',
        callLogEntityMatcherPath: '/callLogger/match',
        callLoggerHideEditLogButton: manifest.platforms[platformName].hideEditLogButton ?? false,

        messageLoggerPath: '/messageLogger',
        messagesLogPageInputChangedEventPath: '/messageLogger/inputChanged',
        messageLogEntityMatcherPath: '/messageLogger/match',
        messageLoggerAutoSettingLabel: 'Log SMS conversations automatically',
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
                name: 'Call and SMS logging',
                items: [
                    {
                        id: 'autoLogCall',
                        type: 'boolean',
                        name: 'Log phone calls automatically',
                        description: 'Automatically log calls when they end in this app',
                        readOnly: userCore.getAutoLogCallSetting(userSettings, isAdmin).readOnly,
                        readOnlyReason: userCore.getAutoLogCallSetting(userSettings, isAdmin).warning ?? userCore.getAutoLogCallSetting(userSettings, isAdmin).readOnlyReason,
                        value: userCore.getAutoLogCallSetting(userSettings, isAdmin).value,
                    },
                    {
                        id: 'autoLogSMS',
                        type: 'boolean',
                        name: 'Log SMS conversations automatically',
                        description: 'Automatically log SMS when they are sent or received in this app',
                        readOnly: userCore.getAutoLogSMSSetting(userSettings).readOnly,
                        readOnlyReason: userCore.getAutoLogSMSSetting(userSettings).readOnlyReason,
                        value: userCore.getAutoLogSMSSetting(userSettings).value,
                    },
                    {
                        id: 'autoLogInboundFax',
                        type: 'boolean',
                        name: 'Log inbound faxes automatically',
                        description: 'Automatically log inbound faxes when they are received in this app',
                        readOnly: userCore.getAutoLogInboundFaxSetting(userSettings).readOnly,
                        readOnlyReason: userCore.getAutoLogInboundFaxSetting(userSettings).readOnlyReason,
                        value: userCore.getAutoLogInboundFaxSetting(userSettings).value,
                    },
                    {
                        id: 'autoLogOutboundFax',
                        type: 'boolean',
                        name: 'Log outbound faxes automatically',
                        description: 'Automatically log outbound faxes when they are sent in this app',
                        readOnly: userCore.getAutoLogOutboundFaxSetting(userSettings).readOnly,
                        readOnlyReason: userCore.getAutoLogOutboundFaxSetting(userSettings).readOnlyReason,
                        value: userCore.getAutoLogOutboundFaxSetting(userSettings).value,
                    },
                    {
                        id: "disableRetroCallLogSync",
                        type: "boolean",
                        name: 'Disable retroactive call log sync',
                        readOnly: userCore.getDisableRetroCallLogSync(userSettings).readOnly,
                        readOnlyReason: userCore.getDisableRetroCallLogSync(userSettings).readOnlyReason,
                        value: userCore.getDisableRetroCallLogSync(userSettings).value
                    },
                    {
                        id: "oneTimeLog",
                        type: "boolean",
                        name: 'Enable one-time call logging',
                        description: 'Log calls when all data is ready. EDIT log permission is not required.',
                        readOnly: userCore.getOneTimeLogSetting(userSettings).readOnly,
                        readOnlyReason: userCore.getOneTimeLogSetting(userSettings).readOnlyReason,
                        value: userCore.getOneTimeLogSetting(userSettings).value
                    },
                    {
                        id: "popupLogPageAfterCall",
                        type: "boolean",
                        name: '(Manual log) Open call logging page after call',
                        readOnly: userCore.getCallPopSetting(userSettings).readOnly,
                        readOnlyReason: userCore.getCallPopSetting(userSettings).readOnlyReason,
                        value: userCore.getCallPopSetting(userSettings).value
                    },
                    {
                        id: "popupLogPageAfterSMS",
                        type: "boolean",
                        name: '(Manual log) Open SMS logging page after message',
                        readOnly: userCore.getSMSPopSetting(userSettings).readOnly,
                        readOnlyReason: userCore.getSMSPopSetting(userSettings).readOnlyReason,
                        value: userCore.getSMSPopSetting(userSettings).value
                    }
                ]
            },
            {
                id: 'urlWhitelist',
                type: 'section',
                name: 'Allowed pages',
                groupId: 'general',
                items: [
                    {
                        id: 'urlWhitelist',
                        type: 'text',
                        name: 'Allowed page URLs',
                        description: 'Enter the URLs of the pages to be whitelisted. Separate multiple URLs with commas. Use * as wildcard.',
                        value: userCore.getUrlWhitelistSetting(userSettings).value,
                        readOnly: userCore.getUrlWhitelistSetting(userSettings).readOnly,
                        readOnlyReason: userCore.getUrlWhitelistSetting(userSettings).readOnlyReason
                    }
                ]
            },
            {
                id: 'tabs',
                type: 'section',
                name: 'Customize tabs',
                groupId: 'general',
                items: [
                    {
                        id: 'showChatTab',
                        type: 'boolean',
                        name: 'Show chat tab',
                        value: userCore.getShowChatTabSetting(userSettings).value,
                        readOnly: userCore.getShowChatTabSetting(userSettings).readOnly,
                        readOnlyReason: userCore.getShowChatTabSetting(userSettings).readOnlyReason
                    },
                    {
                        id: 'showMeetingsTab',
                        type: 'boolean',
                        name: 'Show meetings tab',
                        value: userCore.getShowMeetingsTabSetting(userSettings).value,
                        readOnly: userCore.getShowMeetingsTabSetting(userSettings).readOnly,
                        readOnlyReason: userCore.getShowMeetingsTabSetting(userSettings).readOnlyReason
                    },
                    {
                        id: 'showTextTab',
                        type: 'boolean',
                        name: 'Show text tab',
                        value: userCore.getShowTextTabSetting(userSettings).value,
                        readOnly: userCore.getShowTextTabSetting(userSettings).readOnly,
                        readOnlyReason: userCore.getShowTextTabSetting(userSettings).readOnlyReason
                    },
                    {
                        id: 'showFaxTab',
                        type: 'boolean',
                        name: 'Show fax tab',
                        value: userCore.getShowFaxTabSetting(userSettings).value,
                        readOnly: userCore.getShowFaxTabSetting(userSettings).readOnly,
                        readOnlyReason: userCore.getShowFaxTabSetting(userSettings).readOnlyReason
                    },
                    {
                        id: 'showVoicemailTab',
                        type: 'boolean',
                        name: 'Show voicemail tab',
                        value: userCore.getShowVoicemailTabSetting(userSettings).value,
                        readOnly: userCore.getShowVoicemailTabSetting(userSettings).readOnly,
                        readOnlyReason: userCore.getShowVoicemailTabSetting(userSettings).readOnlyReason
                    },
                    {
                        id: 'showRecordingsTab',
                        type: 'boolean',
                        name: 'Show recordings tab',
                        value: userCore.getShowRecordingsTabSetting(userSettings).value,
                        readOnly: userCore.getShowRecordingsTabSetting(userSettings).readOnly,
                        readOnlyReason: userCore.getShowRecordingsTabSetting(userSettings).readOnlyReason
                    },
                    {
                        id: 'showContactsTab',
                        type: 'boolean',
                        name: 'Show contacts tab',
                        value: userCore.getShowContactsTabSetting(userSettings).value,
                        readOnly: userCore.getShowContactsTabSetting(userSettings).readOnly,
                        readOnlyReason: userCore.getShowContactsTabSetting(userSettings).readOnlyReason
                    }
                ]
            },
            {
                id: 'contacts',
                type: 'section',
                name: 'Call-pop',
                items: [
                    {
                        id: 'openContactPageFromIncomingCall',
                        type: 'option',
                        name: 'Incoming call pop',
                        description: 'Select when to trigger call pop for incoming calls.',
                        options: [
                            {
                                id: 'disabled',
                                name: 'Disabled'
                            },
                            {
                                id: 'onFirstRing',
                                name: 'On first ring'
                            },
                            {
                                id: 'onAnswer',
                                name: 'On answer'
                            }
                        ],
                        value: userCore.getIncomingCallPop(userSettings).value,
                        readOnly: userCore.getIncomingCallPop(userSettings).readOnly,
                        readOnlyReason: userCore.getIncomingCallPop(userSettings).readOnlyReason,
                    },
                    {
                        id: 'openContactPageFromOutgoingCall',
                        type: 'option',
                        name: 'Outgoing call pop',
                        description: 'Select when to trigger call pop for outgoing calls.',
                        options: [
                            {
                                id: 'disabled',
                                name: 'Disabled'
                            },
                            {
                                id: 'onFirstRing',
                                name: 'On first ring'
                            },
                            {
                                id: 'onAnswer',
                                name: 'On answer'
                            }
                        ],
                        value: userCore.getOutgoingCallPop(userSettings).value,
                        readOnly: userCore.getOutgoingCallPop(userSettings).readOnly,
                        readOnlyReason: userCore.getOutgoingCallPop(userSettings).readOnlyReason
                    },
                    {
                        id: 'multiContactMatchBehavior',
                        type: 'option',
                        name: 'Multi-contact match behavior',
                        description: 'Select what to do when multiple contacts match a phone number.',
                        options: [
                            {
                                id: 'disabled',
                                name: 'Disabled'
                            },
                            {
                                id: 'openAllMatches',
                                name: 'Open all matches'
                            },
                            {
                                id: 'promptToSelect',
                                name: 'Prompt to select'
                            }
                        ],
                        value: userCore.getCallPopMultiMatchBehavior(userSettings).value,
                        readOnly: userCore.getCallPopMultiMatchBehavior(userSettings).readOnly,
                        readOnlyReason: userCore.getCallPopMultiMatchBehavior(userSettings).readOnlyReason,
                    },
                    (platform.enableExtensionNumberLoggingSetting ?
                        {
                            id: 'allowExtensionNumberLogging',
                            type: 'boolean',
                            name: 'Allow extension number logging',
                            value: userSettings?.allowExtensionNumberLogging?.value ?? false,
                            readOnly: userSettings?.allowExtensionNumberLogging?.customizable === undefined ? false : !userSettings?.allowExtensionNumberLogging?.customizable,
                            readOnlyReason: 'This setting is managed by admin'
                        } : {}),
                    {
                        id: 'openContactPageAfterCreation',
                        type: 'boolean',
                        name: 'Contact created call pop',
                        description: 'Open contact immediately after creating it',
                        value: userCore.getOpenContactAfterCreationSetting(userSettings).value,
                        readOnly: userCore.getOpenContactAfterCreationSetting(userSettings).readOnly,
                        readOnlyReason: userCore.getOpenContactAfterCreationSetting(userSettings).readOnlyReason
                    }
                ]
            },
            {
                id: "openSupportPage",
                type: "button",
                name: "Support",
                buttonLabel: "Open",
                buttonType: "link",
            },
            {
                id: "openAboutPage",
                type: "button",
                name: "About",
                buttonLabel: "Open",
                buttonType: "link",
            },
            {
                id: "advancedFeatures",
                type: "group",
                name: "Advanced features",
                items: [
                    {
                        id: 'developerMode',
                        type: 'boolean',
                        name: 'Developer mode',
                        description: 'Enable developer mode to access developer settings.',
                        value: userCore.getDeveloperModeSetting(userSettings, developerMode).value,
                        readOnly: userCore.getDeveloperModeSetting(userSettings).readOnly,
                        readOnlyReason: userCore.getDeveloperModeSetting(userSettings).readOnlyReason
                    },
                    {
                        id: 'autoOpenExtension',
                        type: 'boolean',
                        name: 'Auto-open extension',
                        description: 'The extension will be opened when a CRM page is loaded.',
                        value: userCore.getAutoOpenSetting(userSettings).value,
                        readOnly: userCore.getAutoOpenSetting(userSettings).readOnly,
                        readOnlyReason: userCore.getAutoOpenSetting(userSettings).readOnlyReason
                    }
                ]
            }
        ],
        buttonEventPath: '/custom-button-click'
    }
    if (customSettings) {
        for (const cs of customSettings) {
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
                value: "Please input your overriding phone number format: (please use * to represent a number, eg. (***) ***-****)",
            },
            {
                id: "overridingPhoneNumberFormat",
                name: "Format 1",
                type: "string",
                value: userSettings?.overridingPhoneNumberFormat?.value ?? "",
                readOnly: userSettings?.overridingPhoneNumberFormat?.customizable === undefined ? false : !userSettings?.overridingPhoneNumberFormat?.customizable,
                readOnlyReason: !userSettings?.overridingPhoneNumberFormat?.customizable ? 'This setting is managed by admin' : ''
            },
            {
                id: "overridingPhoneNumberFormat2",
                name: "Format 2",
                type: "string",
                value: userSettings?.overridingPhoneNumberFormat2?.value ?? "",
                readOnly: userSettings?.overridingPhoneNumberFormat2?.customizable === undefined ? false : !userSettings?.overridingPhoneNumberFormat2?.customizable,
                readOnlyReason: !userSettings?.overridingPhoneNumberFormat2?.customizable ? 'This setting is managed by admin' : ''
            },
            {
                id: "overridingPhoneNumberFormat3",
                name: "Format 3",
                type: "string",
                value: userSettings?.overridingPhoneNumberFormat3?.value ?? "",
                readOnly: userSettings?.overridingPhoneNumberFormat3?.customizable === undefined ? false : !userSettings?.overridingPhoneNumberFormat3?.customizable,
                readOnlyReason: !userSettings?.overridingPhoneNumberFormat3?.customizable ? 'This setting is managed by admin' : ''
            }
        ]
        const optionSectionName = platform.displayName + " options";
        services.settings.find(s => s.name === optionSectionName).items.push(
            {
                id: "numberFormatterTitle",
                name: "Number formatter",
                type: "typography",
                variant: "title2",
                value: "Phone number format alternatives",
            });
        services.settings.find(s => s.name === optionSectionName).items.push(...numberFormatterComponent);
    }
    if (platformName === 'googleSheets') {
        services.settings.unshift(
            {
                id: 'googleSheetsConfig',
                type: 'button',
                name: 'Google Sheets Config',
                buttonLabel: 'Open',
                buttonType: 'link',
            }
        )
    }

    if (userCore.getDeveloperModeSetting(userSettings, developerMode).value) {
        services.settings.push(
            {
                id: 'openDeveloperSettingsPage',
                type: 'button',
                name: 'Developer settings',
                buttonLabel: 'Open',
                buttonType: "link",
            }
        )
    }
    return services;
}

exports.getServiceManifest = getServiceManifest;