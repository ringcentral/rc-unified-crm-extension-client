function getServerSideLoggingSettingPageRender({ subscriptionLevel, doNotLogNumbers }) {
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
                    oneOf:[
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
            serverSideLogging: subscriptionLevel,
            doNotLogNumbers: doNotLogNumbers
        }
    };
    return pageRender;
}

exports.getServerSideLoggingSettingPageRender = getServerSideLoggingSettingPageRender;