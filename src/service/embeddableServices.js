import userCore from '../core/user';

async function getServiceManifest({
    platform,
    crmAuthed,
    isAdmin,
    manifest,
    userSettings,
    userPermissions
}) {
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
        authorizedAccount: '',
        info: `Developed by ${manifest?.author?.name ?? 'Unknown'}`,

        // Enable call log sync feature
        callLoggerPath: '/callLogger',
        callLogPageInputChangedEventPath: '/callLogger/inputChanged',
        callLogEntityMatcherPath: '/callLogger/match',
        callLoggerAutoSettingLabel: 'Log phone calls automatically',
        callLoggerAutoSettingReadOnly: userCore.getAutoLogCallSetting(userSettings, isAdmin).readOnly,
        callLoggerAutoSettingReadOnlyReason: userCore.getAutoLogCallSetting(userSettings, isAdmin).readOnlyReason,
        callLoggerAutoSettingReadOnlyValue: userCore.getAutoLogCallSetting(userSettings, isAdmin).value,
        callLoggerHideEditLogButton: manifest.platforms[platformName].hideEditLogButton ?? false,
        callLoggerAutoSettingWarning: userCore.getAutoLogCallSetting(userSettings, isAdmin).warning ?? '',

        messageLoggerPath: '/messageLogger',
        messagesLogPageInputChangedEventPath: '/messageLogger/inputChanged',
        messageLogEntityMatcherPath: '/messageLogger/match',
        messageLoggerAutoSettingLabel: 'Log SMS conversations automatically',
        messageLoggerAutoSettingReadOnly: userCore.getAutoLogSMSSetting(userSettings).readOnly,
        messageLoggerAutoSettingReadOnlyReason: userCore.getAutoLogSMSSetting(userSettings).readOnlyReason,
        messageLoggerAutoSettingReadOnlyValue: userCore.getAutoLogSMSSetting(userSettings).value,

        settingsPath: '/settings',
        settings: [
            {
                id: "disableRetroCallLogSync",
                type: "boolean",
                groupId: "logging",
                name: 'Disable retroactive call log sync',
                readOnly: userCore.getDisableRetroCallLogSync(userSettings).readOnly,
                readOnlyReason: userCore.getDisableRetroCallLogSync(userSettings).readOnlyReason,
                value: userCore.getDisableRetroCallLogSync(userSettings).value
            },
            {
                id: "oneTimeLog",
                type: "boolean",
                groupId: "logging",
                name: 'Enable one-time call logging',
                description: 'Log calls when all data is ready. EDIT log permission is not required.',
                readOnly: userCore.getDisableRetroCallLogSync(userSettings).readOnly,
                readOnlyReason: userCore.getDisableRetroCallLogSync(userSettings).readOnlyReason,
                value: userCore.getDisableRetroCallLogSync(userSettings).value
            },
            {
                id: "popupLogPageAfterCall",
                type: "boolean",
                groupId: "logging",
                name: '(Manual log) Open call logging page after call',
                readOnly: userCore.getCallPopSetting(userSettings).readOnly,
                readOnlyReason: userCore.getCallPopSetting(userSettings).readOnlyReason,
                value: userCore.getCallPopSetting(userSettings).value
            },
            {
                id: "popupLogPageAfterSMS",
                type: "boolean",
                groupId: "logging",
                name: '(Manual log) Open SMS logging page after message',
                readOnly: userCore.getSMSPopSetting(userSettings).readOnly,
                readOnlyReason: userCore.getSMSPopSetting(userSettings).readOnlyReason,
                value: userCore.getSMSPopSetting(userSettings).value
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
                        value: userCore.getDeveloperModeSetting(userSettings).value,
                        readOnly: userCore.getDeveloperModeSetting(userSettings).readOnly,
                        readOnlyReason: userCore.getDeveloperModeSetting(userSettings).readOnlyReason
                    },
                    {
                        id: 'autoOpenExtension',
                        type: 'boolean',
                        name: 'Auto-open extension',
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
                                options: item.options,
                                value: userCore.getCustomSetting(userSettings, item.id, item.defaultValue).value,
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
            services.settings.unshift(group);
        }
    };
    if (platformName === 'clio' || platformName === 'insightly') {
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
        services.settings.find(s => s.id === 'contacts').items.push(
            {
                id: "numberFormatterTitle",
                name: "Number formatter",
                type: "typography",
                variant: "title2",
                value: "Phone number format alternatives",
            });
        services.settings.find(s => s.id === 'contacts').items.push(...numberFormatterComponent);
    }

    if (userCore.getDeveloperModeSetting(userSettings).value) {
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