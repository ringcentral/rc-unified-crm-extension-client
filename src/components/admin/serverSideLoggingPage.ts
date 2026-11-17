type UnknownRecord = Record<string, any>;

const RINGCX_SETUP_GUIDE_URL = 'https://appconnect.labs.ringcentral.com/users/ringcx/#setting-up-ringcx-logging';

const ringcxSetupSteps = [
    'In RingCX Admin, go to Settings > Accounts, select the sub-account, and open Integrations > Generic HTTP.',
    'Paste this URL as the Call Event URL and turn on Send body as JSON.',
    'Turn on both the Call Ended event and the Outbound call event. Without the Outbound call event, dial group and campaign calls are not sent.',
    'Add a header, for example X-App-Connect with the value RingCX, then save. The form shows an error if no header is set. App Connect does not check this header.',
    'Repeat for each RingCX sub-account whose calls you want to log.',
];

// The page is rendered from the saved subscription, so the URL appears only once RingCX is a saved
// source. The URL is a credential: it is shown read-only here, never logged.
function getRingCXWebhookSection({ ringcxSaved, ringcxWebhookUrl }: UnknownRecord): UnknownRecord {
    const properties: UnknownRecord = {};
    const uiSchema: UnknownRecord = { "ui:collapsible": true };
    const formData: UnknownRecord = {};
    if (!ringcxSaved) {
        properties.ringcxWebhookSaveFirst = {
            type: 'string',
            description: 'Turn on server side logging with RingCX selected in Call sources, then save to get the RingCX call events URL.',
        };
        uiSchema.ringcxWebhookSaveFirst = {
            "ui:field": "admonition",
            "ui:severity": "info",
        };
    } else if (!ringcxWebhookUrl) {
        properties.ringcxWebhookMissing = {
            type: 'string',
            description: 'No RingCX call events URL has been generated for this account yet.',
        };
        uiSchema.ringcxWebhookMissing = {
            "ui:field": "typography",
            "ui:variant": "body1",
        };
        properties.generateRingcxWebhookUrlButton = {
            type: 'string',
            title: 'Generate URL',
        };
        uiSchema.generateRingcxWebhookUrlButton = {
            "ui:field": "button",
            "ui:variant": "outlined",
            "ui:fullWidth": true,
        };
    } else {
        properties.ringcxWebhookDescription = {
            type: 'string',
            description: 'RingCX sends a call event to this URL when each call ends. Keep it private, like a password.',
        };
        uiSchema.ringcxWebhookDescription = {
            "ui:field": "typography",
            "ui:variant": "caption1",
        };
        // Named after the RingCX Generic HTTP field it is pasted into.
        properties.ringcxWebhookUrl = {
            type: 'string',
            title: 'Call Event URL',
            readOnly: true,
        };
        formData.ringcxWebhookUrl = ringcxWebhookUrl;
        properties.regenerateRingcxWebhookUrlButton = {
            type: 'string',
            title: 'Regenerate URL',
        };
        uiSchema.regenerateRingcxWebhookUrlButton = {
            "ui:field": "button",
            "ui:variant": "text",
            "ui:fullWidth": true,
        };
        ringcxSetupSteps.forEach((step, index) => {
            const key = `ringcxWebhookStep${index + 1}`;
            properties[key] = {
                type: 'string',
                description: `${index + 1}. ${step}`,
            };
            uiSchema[key] = {
                "ui:field": "typography",
                "ui:variant": "caption1",
            };
        });
    }
    properties.ringcxSetupGuide = {
        type: 'string',
        description: 'RingCX setup guide',
    };
    uiSchema.ringcxSetupGuide = {
        "ui:field": "link",
        "ui:variant": "body1",
        "ui:href": RINGCX_SETUP_GUIDE_URL,
    };
    return {
        property: {
            type: 'object',
            title: 'RingCX call events URL',
            properties,
        },
        uiSchema,
        formData,
    };
}

function getServerSideLoggingSettingPageRender({ subscriptionLevel, doNotLogNumbers, loggingByAdmin, subscribedByOtherAdmin, enableUserMapping, additionalFields = [], additionalFieldValues = {}, userPermissions = {}, sources = [], ringcxWebhookUrl = null }: UnknownRecord): UnknownRecord {
    const additionalProperties: UnknownRecord = {};
    additionalFields.forEach((field: UnknownRecord) => {
        additionalProperties[field.const] = {
            type: 'string',
            title: field.title,
            description: field.description,
        };
        if (field.oneOf) {
            additionalProperties[field.const].oneOf = field.oneOf;
        }
        if (field.enum) {
            additionalProperties[field.const].enum = field.enum;
        }
        if (field.enumNames) {
            additionalProperties[field.const].enumNames = field.enumNames;
        }
    });
    const warningProperty: UnknownRecord = {};
    const warningUiSchema: UnknownRecord = {};
    if (subscribedByOtherAdmin) {
        warningProperty.warning = {
            type: 'string',
            description: `Server side logging is currently managed by ${subscribedByOtherAdmin.name}`
        }
        warningUiSchema.warning = {
            "ui:field": "admonition",
            "ui:severity": "warning",  // "warning", "info", "error", "success"
        }
    }
    const sourcesProperty: UnknownRecord = {};
    const sourcesUiSchema: UnknownRecord = {};
    let sourcesFormData = ['ex'];
    // RingCX calls are logged from RingCX call events, so RingSense is not required.
    const canUseCallSources = !!userPermissions.ringCX;
    if (canUseCallSources) {
        sourcesFormData = sources;
        sourcesProperty.sources = {
            type: "array",
            title: "Call sources",
            description: "Choose which RingCentral products have their calls logged server-side.",
            items: {
                type: "string",
            },
            enum: [
                'ex',
                "cx",
            ],
            enumNames: [
                'RingEX',
                'RingCX (Experimental)',
            ],
        };
        sourcesUiSchema.sources = {
            "ui:widget": "checkboxes",
            "ui:options": {
                inline: true,
                "enumOptions": [
                    {
                        "value": "ex",
                        "label": "RingEX"
                    },
                    {
                        "value": "cx",
                        "label": "RingCX (Experimental)"
                    },
                ]
            },
        };
    } else {
        sourcesFormData = ['ex'];
    }
    const ringcxProperty: UnknownRecord = {};
    const ringcxUiSchema: UnknownRecord = {};
    const ringcxFormData: UnknownRecord = {};
    if (canUseCallSources && !subscribedByOtherAdmin) {
        const ringcxSection = getRingCXWebhookSection({
            ringcxSaved: subscriptionLevel !== 'Disable' && sources.includes('cx'),
            ringcxWebhookUrl,
        });
        ringcxProperty.ringcxWebhookHolder = ringcxSection.property;
        ringcxUiSchema.ringcxWebhookHolder = ringcxSection.uiSchema;
        ringcxFormData.ringcxWebhookHolder = ringcxSection.formData;
    }
    const pageRender: UnknownRecord =
    {
        id: 'serverSideLoggingSetting',
        title: 'Universal Logging',
        type: 'page',
        schema: {
            type: 'object',
            required: [],
            properties: {
                ...warningProperty,
                serverSideLoggingHolder: {
                    type: 'object',
                    title: 'Logging settings',
                    properties: {
                        serverSideLogging: {
                            type: 'string',
                            title: 'Enable server side logging',
                            readOnly: !!subscribedByOtherAdmin,
                            oneOf: [
                                {
                                    const: 'Account',
                                    title: 'Enable for account'
                                },
                                {
                                    const: 'User',
                                    title: 'Enable for admin only (trial mode)'
                                },
                                {
                                    const: 'Disable',
                                    title: 'Disable'
                                }
                            ]
                        },
                        activityRecordOwner: {
                            readOnly: !!subscribedByOtherAdmin,
                            title: 'Activity record owner',
                            type: 'string',
                            oneOf: [
                                {
                                    const: 'user',
                                    title: 'Agent/user (if possible)'
                                },
                                {
                                    const: 'admin',
                                    title: 'Admin'
                                }
                            ]
                        },
                        ...sourcesProperty,
                        ...additionalProperties,
                        saveServerSideLoggingButton: {
                            type: 'string',
                            title: 'Save'
                        }
                    }
                },
                ...ringcxProperty,
                doNotLogNumbersHolder: {
                    readOnly: !!subscribedByOtherAdmin,
                    type: 'object',
                    title: 'Do not log',
                    properties: {
                        doNotLogNumbers: {
                            type: 'string',
                            title: 'Do not log numbers (separated by comma)'
                        },
                        doNotLogNumbersWarning: {
                            type: 'string',
                            description: 'Calls to or from these numbers will never be logged, regardless of any other setting. Numbers are automatically normalized to E.164 format. For example, (123) 456-7890 becomes +11234567890.'
                        },
                        doNotLogNumbersSubmitButton: {
                            type: 'string',
                            title: 'Save'
                        }
                    }
                },
                ...(enableUserMapping ? {
                    section: {
                        type: 'string',
                        oneOf: [
                            {
                                const: "userMapping",
                                title: "User mapping",
                            }
                        ]
                    }
                } : {})
            }
        },
        uiSchema: {
            ...warningUiSchema,
            ...ringcxUiSchema,
            doNotLogNumbersHolder: {
                "ui:collapsible": true,
                doNotLogNumbers: {
                    "ui:placeholder": 'Enter do not log numbers, separated by comma',
                    "ui:widget": "textarea", // show note input as textarea
                },
                doNotLogNumbersWarning: {
                    "ui:field": "admonition",
                    "ui:severity": "warning",  // "warning", "info", "error", "success"
                },
                doNotLogNumbersSubmitButton: {
                    "ui:field": "button",
                    "ui:variant": "contained", // "text", "outlined", "contained", "plain"
                    "ui:fullWidth": true,
                    "ui:disabled": !!subscribedByOtherAdmin
                }
            },
            serverSideLoggingHolder: {
                "ui:collapsible": true,
                saveServerSideLoggingButton: {
                    "ui:field": "button",
                    "ui:variant": "contained", // "text", "outlined", "contained", "plain"
                    "ui:fullWidth": true,
                    "ui:disabled": !!subscribedByOtherAdmin
                },
                ...sourcesUiSchema,
            },
            section: {
                "ui:field": "list",
                "ui:navigation": true,
                "ui:style": {
                    marginTop: '-10px'
                }
            }
        },
        formData: {
            serverSideLoggingHolder: {
                serverSideLogging: subscriptionLevel,
                activityRecordOwner: loggingByAdmin ? 'admin' : 'user',
                sources: sourcesFormData,
            },
            ...ringcxFormData,
            doNotLogNumbersHolder: {
                doNotLogNumbers: doNotLogNumbers,
            },
        }
    };
    additionalFields.forEach((field: UnknownRecord) => {
        if (field.uiSchema) {
            pageRender.uiSchema.serverSideLoggingHolder[field.const] = field.uiSchema;
        }
        if (typeof additionalFieldValues[field.const] !== 'undefined') {
            pageRender.formData.serverSideLoggingHolder[field.const] = additionalFieldValues[field.const];
        }
    });
    return pageRender;
}

function getRingCXWebhookRotatePageRender(): UnknownRecord {
    return {
        id: 'ringcxWebhookRotatePage',
        title: 'Regenerate URL',
        type: 'page',
        schema: {
            type: 'object',
            required: [],
            properties: {
                ringcxWebhookRotateWarning: {
                    type: 'string',
                    description: 'Regenerate the RingCX call events URL? The current URL stops logging calls immediately. Paste the new URL into every RingCX sub-account that uses it.',
                },
                confirmRingcxWebhookRotateButton: {
                    type: 'string',
                    title: 'Regenerate URL',
                },
                cancelRingcxWebhookRotateButton: {
                    type: 'string',
                    title: 'Cancel',
                },
            },
        },
        uiSchema: {
            ringcxWebhookRotateWarning: {
                "ui:field": "admonition",
                "ui:severity": "warning",
            },
            confirmRingcxWebhookRotateButton: {
                "ui:field": "button",
                "ui:variant": "contained",
                "ui:fullWidth": true,
            },
            cancelRingcxWebhookRotateButton: {
                "ui:field": "button",
                "ui:variant": "text",
                "ui:fullWidth": true,
            },
        },
        formData: {},
    };
}

export { getServerSideLoggingSettingPageRender, getRingCXWebhookRotatePageRender, RINGCX_SETUP_GUIDE_URL };
export default {
    getServerSideLoggingSettingPageRender,
    getRingCXWebhookRotatePageRender,
};
