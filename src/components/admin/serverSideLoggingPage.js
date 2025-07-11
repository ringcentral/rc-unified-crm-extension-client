function getServerSideLoggingSettingPageRender({ subscriptionLevel, doNotLogNumbers, loggingByAdmin, additionalFields = [], additionalFieldValues = {} }) {
    const additionalProperties = {};
    additionalFields.forEach(field => {
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
    const pageRender =
    {
        id: 'serverSideLoggingSetting',
        title: 'Server side logging (Beta)',
        type: 'page',
        schema: {
            type: 'object',
            required: [],
            properties: {
                serverSideLogging: {
                    type: 'string',
                    title: 'Enable server side logging',
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
                    title: 'Activity record owner',
                    description: 'Who should be the owner of the activity record?',
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
                doNotLogNumbers: {
                    type: 'string',
                    title: 'Do not log numbers (separated by comma)'
                },
                doNotLogNumbersWarning: {
                    type: 'string',
                    description: 'All numbers will be auto-formatted as E.164 standard. Eg. (123) 456-7890 -> +11234567890'
                },
                ...additionalProperties,
                saveServerSideLoggingButton: {
                    type: 'string',
                    title: 'Save'
                }
            }
        },
        uiSchema: {
            doNotLogNumbers: {
                "ui:placeholder": 'Enter do not log numbers, separated by comma',
                "ui:widget": "textarea", // show note input as textarea
            },
            doNotLogNumbersWarning: {
                "ui:field": "admonition",
                "ui:severity": "warning",  // "warning", "info", "error", "success"
            },
            saveServerSideLoggingButton: {
                "ui:field": "button",
                "ui:variant": "contained", // "text", "outlined", "contained", "plain"
                "ui:fullWidth": true
            }
        },
        formData: {
            serverSideLogging: subscriptionLevel,
            doNotLogNumbers: doNotLogNumbers,
            activityRecordOwner: loggingByAdmin ? 'admin' : 'user'
        }
    };
    additionalFields.forEach(field => {
        if (field.uiSchema) {
            pageRender.uiSchema[field.const] = field.uiSchema;
        }
        if (typeof additionalFieldValues[field.const] !== 'undefined') {
            pageRender.formData[field.const] = additionalFieldValues[field.const];
        }
    });
    return pageRender;
}

exports.getServerSideLoggingSettingPageRender = getServerSideLoggingSettingPageRender;