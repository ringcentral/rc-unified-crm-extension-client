function getServerSideLoggingSettingPageRender({ enabled, subscriptionLevel, doNotLogNumbers }) {
    const pageRender =
    {
        id: 'serverSideLoggingSetting',
        title: 'Server side logging (Beta)',
        type: 'page',
        schema: {
            type: 'object',
            required: [],
            properties: {
                enableServerSideLogging: {
                    type: 'boolean',
                    title: 'Enable server side logging'
                },
                trialMode: {
                    type: 'boolean',
                    title: 'Trial mode (logging only applicable to your extension)'
                },
                doNotLogNumbers: {
                    type: 'string',
                    title: 'Do not log numbers (separated by comma)'
                },
                doNotLogNumbersWarning: {
                    type: 'string',
                    description: 'All numbers will be auto-formatted as E.164 standard. Eg. (123) 456-7890 -> +11234567890'
                },
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
            enableServerSideLogging: enabled,
            doNotLogNumbers: doNotLogNumbers,
            trialMode: subscriptionLevel != 'Account'
        }
    };
    return pageRender;
}

exports.getServerSideLoggingSettingPageRender = getServerSideLoggingSettingPageRender;