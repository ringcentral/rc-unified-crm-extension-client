function getServerSideLoggingSettingPageRender({ adminUserSettings }) {
    return {
        id: 'serverSideLoggingSetting',
        title: 'Server side logging (Experimental)',
        type: 'page',
        schema: {
            type: 'object',
            required: [],
            properties: {
                enableServerSideLogging: {
                    type: 'boolean',
                    title: 'Enable server side logging'
                },
                doNotLogNumbers: {
                    type: 'string',
                    title: 'Do not log numbers (separated by comma)'
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
            saveServerSideLoggingButton: {
                "ui:field": "button",
                "ui:variant": "contained", // "text", "outlined", "contained", "plain"
                "ui:fullWidth": true
            }
        },
        formData: {
            enableServerSideLogging: adminUserSettings?.serverSideLogging?.enable ?? false,
            doNotLogNumbers: adminUserSettings?.serverSideLogging?.doNotLogNumbers ?? '',
        }
    }
}

exports.getServerSideLoggingSettingPageRender = getServerSideLoggingSettingPageRender;