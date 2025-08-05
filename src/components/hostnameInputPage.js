function getHostnameInputPageRender({ platformName, url }) {
    return {
        id: 'hostnameInputPage',
        title: 'Enter hostname',
        type: 'page',
        schema: {
            type: 'object',
            properties: {
                instructionTitle: {
                    type: 'string',
                    description: `Please setup your ${platformName} account url:`
                },
                instruction1: {
                    type: 'string',
                    description: `1. Login to your ${platformName} account`
                },
                instruction2: {
                    type: 'string',
                    description: '2. Copy the url and paste it here'
                },
                url: {
                    type: 'string',
                    title: `${platformName} url`
                }
            },
            required: ['url']
        },
        uiSchema: {
            instructionTitle: {
                "ui:field": "typography", // or typography to show raw text,
                "ui:variant": "body2"
            },
            instruction1: {
                "ui:field": "typography", // or typography to show raw text
                "ui:bulletedList": true
            },
            instruction2: {
                "ui:field": "typography", // or typography to show raw text
                "ui:bulletedList": true
            },
            url: {
                "ui:placeholder": 'url...',
            },
            submitButtonOptions: { // optional if you don't want to show submit button
                submitText: 'Save',
            }
        },
        formData: {
            url: url ?? ''
        }
    }
}

exports.getHostnameInputPageRender = getHostnameInputPageRender;