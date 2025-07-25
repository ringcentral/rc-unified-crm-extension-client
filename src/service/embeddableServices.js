import userCore from '../core/user';
import authCore from '../core/auth';
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
                id: 'activityLogging',
                type: 'section',
                name: 'Activity logging',
                items: [
                    {
                        id: 'activityLoggingOptions',
                        type: 'option',
                        name: ' Enable automatic activity logging for:',
                        multiple: true,
                        checkbox: true,
                        description: 'Automatically log activities for the selected entities',
                        options: [
                            {
                                id: 'oneTimeLog',
                                name: 'One-time call logging'
                            },
                            {
                                id: 'autoLogAnsweredIncoming',
                                name: 'Answered incoming calls'
                            },
                            {
                                id: 'autoLogMissedIncoming',
                                name: 'Missed incoming calls'
                            },
                            {
                                id: 'autoLogOutgoing',
                                name: 'Outgoing calls'
                            },
                            {
                                id: 'autoLogVoicemails',
                                name: 'Voicemails'
                            },
                            {
                                id: 'autoLogSMS',
                                name: 'SMS'
                            },
                            {
                                id: 'autoLogInboundFax',
                                name: 'Inbound faxes'
                            },
                            {
                                id: 'autoLogOutboundFax',
                                name: 'Outbound faxes'
                            }

                        ],
                        value: (() => {
                            const activityLoggingValues = [
                                ...(userCore.getAutoLogAnsweredIncomingSetting(userSettings, isAdmin).value ? ['autoLogAnsweredIncoming'] : []),
                                ...(userCore.getAutoLogMissedIncomingSetting(userSettings, isAdmin).value ? ['autoLogMissedIncoming'] : []),
                                ...(userCore.getAutoLogOutgoingSetting(userSettings, isAdmin).value ? ['autoLogOutgoing'] : []),
                                ...(userCore.getAutoLogVoicemailsSetting(userSettings).value ? ['autoLogVoicemails'] : []),
                                ...(userCore.getAutoLogSMSSetting(userSettings).value ? ['autoLogSMS'] : []),
                                ...(userCore.getAutoLogInboundFaxSetting(userSettings).value ? ['autoLogInboundFax'] : []),
                                ...(userCore.getAutoLogOutboundFaxSetting(userSettings).value ? ['autoLogOutboundFax'] : []),
                                ...(userCore.getOneTimeLogSetting(userSettings).value ? ['oneTimeLog'] : [])
                            ];
                            console.log('Service manifest activity logging values:', activityLoggingValues);
                            console.log('User settings for activity logging:', {
                                autoLogAnsweredIncoming: userCore.getAutoLogAnsweredIncomingSetting(userSettings, isAdmin),
                                autoLogMissedIncoming: userCore.getAutoLogMissedIncomingSetting(userSettings, isAdmin),
                                autoLogOutgoing: userCore.getAutoLogOutgoingSetting(userSettings, isAdmin),
                                autoLogVoicemails: userCore.getAutoLogVoicemailsSetting(userSettings),
                                autoLogSMS: userCore.getAutoLogSMSSetting(userSettings),
                                autoLogInboundFax: userCore.getAutoLogInboundFaxSetting(userSettings),
                                autoLogOutboundFax: userCore.getAutoLogOutboundFaxSetting(userSettings),
                                oneTimeLog: userCore.getOneTimeLogSetting(userSettings)
                            });
                            return activityLoggingValues;
                        })(),
                        readOnly: userCore.getAutoLogAnsweredIncomingSetting(userSettings, isAdmin).readOnly ||
                            userCore.getAutoLogMissedIncomingSetting(userSettings, isAdmin).readOnly ||
                            userCore.getAutoLogOutgoingSetting(userSettings, isAdmin).readOnly ||
                            userCore.getAutoLogVoicemailsSetting(userSettings).readOnly ||
                            userCore.getAutoLogSMSSetting(userSettings).readOnly ||
                            userCore.getAutoLogInboundFaxSetting(userSettings).readOnly ||
                            userCore.getAutoLogOutboundFaxSetting(userSettings).readOnly ||
                            userCore.getOneTimeLogSetting(userSettings).readOnly,
                        readOnlyReason: userCore.getAutoLogAnsweredIncomingSetting(userSettings, isAdmin).readOnlyReason ||
                            userCore.getAutoLogMissedIncomingSetting(userSettings, isAdmin).readOnlyReason ||
                            userCore.getAutoLogOutgoingSetting(userSettings, isAdmin).readOnlyReason ||
                            userCore.getAutoLogVoicemailsSetting(userSettings).readOnlyReason ||
                            userCore.getAutoLogSMSSetting(userSettings).readOnlyReason ||
                            userCore.getAutoLogInboundFaxSetting(userSettings).readOnlyReason ||
                            userCore.getAutoLogOutboundFaxSetting(userSettings).readOnlyReason ||
                            userCore.getOneTimeLogSetting(userSettings).readOnlyReason
                    },
                    {
                        id: "logSyncFrequency",
                        type: "option",
                        name: '  Log sync frequency',
                        description: 'How often to sync missed activity; disable to turn off background logging',
                        options: [
                            {
                                id: 'disabled',
                                name: 'Disabled'
                            },
                            {
                                id: '10min',
                                name: '10 min'
                            },
                            {
                                id: '30min',
                                name: '30 min'
                            },
                            {
                                id: '1hour',
                                name: '1 hour'
                            },
                            {
                                id: '3hours',
                                name: '3 hours'
                            },
                            {
                                id: '1day',
                                name: '1 day'
                            }
                        ],
                        value: userCore.getLogSyncFrequencySetting(userSettings).value,
                        readOnly: userCore.getLogSyncFrequencySetting(userSettings).readOnly,
                        readOnlyReason: userCore.getLogSyncFrequencySetting(userSettings).readOnlyReason,
                    },
                    {
                        id: 'autoOpenOptions',
                        type: 'option',
                        name: 'Auto-open logging page after:',
                        description: 'Opens the logging page for manual entry after selected events.',
                        multiple: true,
                        checkbox: true,
                        options: [
                            {
                                id: 'popupLogPageAfterSMS',
                                name: 'SMS is sent'
                            },
                            {
                                id: 'popupLogPageAfterCall',
                                name: 'Call ends'
                            }
                        ],
                        value: [
                            ...(userCore.getSMSPopSetting(userSettings).value ? ['popupLogPageAfterSMS'] : []),
                            ...(userCore.getCallPopSetting(userSettings).value ? ['popupLogPageAfterCall'] : [])
                        ],
                        readOnly: userCore.getSMSPopSetting(userSettings).readOnly || userCore.getCallPopSetting(userSettings).readOnly,
                        readOnlyReason: userCore.getSMSPopSetting(userSettings).readOnlyReason || userCore.getCallPopSetting(userSettings).readOnlyReason
                    }
                ]
            },
            {
                id: 'appearance',
                type: 'group',
                name: 'Appearance',
                description: 'Modify the display and theme preferences',
                items: [
                    {
                        id: 'tabs',
                        type: 'section',
                        name: 'Customize tabs',
                        groupId: 'appearance',
                        description: 'Control which tabs are visible in the extension interface',
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
                        id: 'notificationLevel',
                        type: 'section',
                        name: 'Notification level',
                        groupId: 'appearance',
                        description: 'Choose which types of notifications to display',
                        items: [
                            {
                                id: 'notificationLevelSetting',
                                type: 'option',
                                name: 'Notification level',
                                description: 'Select the notification level to be displayed in the extension.',
                                multiple: true,
                                checkbox: true,
                                options: [
                                    {
                                        id: 'success',
                                        name: 'Success'
                                    },
                                    {
                                        id: 'warning',
                                        name: 'Warning'
                                    },
                                    {
                                        id: 'error',
                                        name: 'Error'
                                    }
                                ],
                                value: userCore.getNotificationLevelSetting(userSettings).value,
                                readOnly: userCore.getNotificationLevelSetting(userSettings).readOnly,
                                readOnlyReason: userCore.getNotificationLevelSetting(userSettings).readOnlyReason
                            }
                        ]
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
                        helper: 'Select when to trigger call pop for incoming calls.',
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
                        helper: 'Select when to trigger call pop for outgoing calls.',
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
                        helper: 'Select what to do when multiple contacts match a phone number.',
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
            name: 'Enabled domains',
            groupId: 'general',
            description: 'Manage the URLs App Connect is enabled for',
            items: [
                {
                    id: 'clickToDialEmbedMode',
                    type: 'option',
                    name: 'Enable mode',
                    options: [
                        {
                            id: 'disabled',
                            name: 'Disabled'
                        },
                        {
                            id: 'crmOnly',
                            name: 'Enable for connected CRM only'
                        },
                        {
                            id: 'whitelist',
                            name: 'Block by default (then manage a list of sites to allow)'
                        },
                        {
                            id: 'blacklist',
                            name: 'Allow by default (then manage a list of sites to block)'
                        }
                    ],
                    value: userCore.getClickToDialEmbedMode(userSettings).value,
                    readOnly: userCore.getClickToDialEmbedMode(userSettings).readOnly,
                    readOnlyReason: userCore.getClickToDialEmbedMode(userSettings).readOnlyReason
                },
                {
                    id: 'clickToDialUrls',
                    type: 'array',
                    name: 'URLs',
                    helper: 'Enter the URLs of the pages to be whitelisted. Separate multiple URLs with commas. Use * as wildcard.',
                    value: userCore.getClickToDialUrls(userSettings).value,
                    readOnly: userCore.getClickToDialUrls(userSettings).readOnly,
                    readOnlyReason: userCore.getClickToDialUrls(userSettings).readOnlyReason
                }
            ]
        }
    );
    if (customSettings) {
        for (const cs of customSettings) {
            const items = [];

            // Handle direct setting (cs itself is the setting)
            if (cs.type && !cs.items) {
                switch (cs.type) {
                    case 'option':
                        // Filter options based on permissions
                        const filteredOptions = cs.options ? cs.options.filter(opt =>
                            !opt.requiredPermission || userPermissions[opt.requiredPermission]
                        ) : [];

                        // For checkbox options, build value array from individual option settings
                        let finalValue;
                        let isReadOnly = false;
                        let readOnlyReason = '';

                        if (cs.multiple && cs.checkbox && cs.options) {
                            // Build value array from individual option values
                            finalValue = [];
                            for (const option of filteredOptions) {
                                const optionSetting = userCore.getCustomSetting(userSettings, option.id, false);
                                if (optionSetting.value) {
                                    finalValue.push(option.id);
                                }
                                // If any option is read-only, mark the whole section as read-only
                                if (optionSetting.readOnly) {
                                    isReadOnly = true;
                                    readOnlyReason = optionSetting.readOnlyReason || 'This setting is managed by admin';
                                }
                            }
                            console.log(`User-side ${cs.id} checkbox values:`, {
                                finalValue,
                                isReadOnly,
                                readOnlyReason,
                                optionDetails: filteredOptions.map(opt => ({
                                    id: opt.id,
                                    setting: userCore.getCustomSetting(userSettings, opt.id, false)
                                }))
                            });
                        } else {
                            // Single value setting
                            const currentValue = userCore.getCustomSetting(userSettings, cs.id, cs.defaultValue).value;
                            finalValue = currentValue !== undefined ? currentValue :
                                (cs.multiple ? (cs.defaultValue || []) : (cs.defaultValue || ""));
                            const settingInfo = userCore.getCustomSetting(userSettings, cs.id, cs.defaultValue);
                            isReadOnly = settingInfo.readOnly;
                            readOnlyReason = settingInfo.readOnlyReason;
                        }

                        items.push({
                            id: cs.id,
                            type: "option",
                            name: cs.name,
                            description: cs.description,
                            options: filteredOptions,
                            multiple: cs.multiple ?? false,
                            checkbox: cs.checkbox ?? false,
                            required: cs.required ?? false,
                            value: finalValue,
                            readOnly: isReadOnly,
                            readOnlyReason: readOnlyReason
                        });
                        break;
                    case 'boolean':
                        items.push({
                            id: cs.id,
                            type: cs.type,
                            name: cs.name,
                            description: cs.description,
                            value: userCore.getCustomSetting(userSettings, cs.id, cs.defaultValue).value,
                            readOnly: userCore.getCustomSetting(userSettings, cs.id, cs.defaultValue).readOnly,
                            readOnlyReason: userCore.getCustomSetting(userSettings, cs.id, cs.defaultValue).readOnlyReason
                        });
                        break;
                    case 'inputField':
                        items.push({
                            id: cs.id,
                            type: 'string',
                            name: cs.name,
                            description: cs.description,
                            placeHolder: cs.placeHolder ?? "",
                            value: userCore.getCustomSetting(userSettings, cs.id, cs.defaultValue).value,
                            readOnly: userCore.getCustomSetting(userSettings, cs.id, cs.defaultValue).readOnly,
                            readOnlyReason: userCore.getCustomSetting(userSettings, cs.id, cs.defaultValue).readOnlyReason
                        });
                        break;
                }
            }
            // Handle container with items (existing behavior)
            else if (cs.items) {
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
            }
            // Handle custom settings with section property - add to existing sections
            if (cs.section) {
                console.log({ message: "Adding to existing section", cs, section: cs.section });
                const targetSection = services.settings.find(s => s.id === cs.section);
                if (targetSection && targetSection.items) {
                    // For direct settings (cs.type && !cs.items), add the processed items directly
                    if (cs.type && !cs.items) {
                        // Add each processed item directly to the target section
                        targetSection.items.push(...items);
                        console.log(`Added ${items.length} direct setting(s) from ${cs.id} to section ${cs.section}`);
                    } else {
                        // For container settings, add as a subsection
                        const subsection = {
                            id: cs.id,
                            type: cs.type,
                            name: cs.name,
                            items
                        };
                        targetSection.items.push(subsection);
                        console.log(`Added custom setting subsection ${cs.id} to section ${cs.section}`);
                    }
                } else {
                    console.warn(`Target section ${cs.section} not found, adding as top-level group`);
                    // Fallback: add as top-level group if section not found
                    const group = {
                        id: cs.id,
                        type: cs.type,
                        name: cs.name,
                        items
                    };
                    services.settings.splice(1, 0, group);
                }
            } else {
                // Handle as regular group (existing behavior)
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
        }
    }
    if (platformName === 'clio' || platformName === 'insightly' || platformName === 'netsuite') {
        const numberFormatterComponent = [
            {
                id: "info",
                name: "info",
                type: "admonition",
                severity: "warning",
                value: "Please input your overriding phone number format: (please use # to represent a number digit, eg. (###) ###-###)",
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