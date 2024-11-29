function getCustomAdapterPageRender({ customManifestUrl }) {
    return {
        id: 'customAdapter',
        title: 'Custom adapter',
        type: 'page',
        schema: {
            type: 'object',
            required: [],
            properties: {
                customAdapter: {
                    type: 'string',
                    description: 'If your organization utilizes a custom adapter to connect to your CRM, enter the URL to the adapter below.'
                },
                customManifestUrl: {
                    type: 'string',
                    title: 'Custom manifest URL'
                },
                saveAdminAdapterButton: {
                    type: 'string',
                    title: 'Save'
                }
            }
        },
        uiSchema: {
            customAdapter: {
                'ui:field': 'typography'
            },
            customManifestUrl: {
                "ui:placeholder": 'enter url and save...',
            },
            saveAdminAdapterButton: {
                "ui:field": "button",
                "ui:variant": "contained", // "text", "outlined", "contained", "plain"
                "ui:fullWidth": true
            }
        },
        formData: {
            customManifestUrl
        }
    }
}

exports.getCustomAdapterPageRender = getCustomAdapterPageRender;