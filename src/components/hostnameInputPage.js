function getHostnameInputPageRender({ platformName, platformId, urlIdentifier, inputUrl, isUrlValid, overrides }) {
    const page = {
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
                "ui:help": isUrlValid ? '' : `Invalid url! Please enter it following format: "${urlIdentifier}"`
            },
            submitButtonOptions: { // optional if you don't want to show submit button
                submitText: 'Next',
            }
        },
        formData: {
            url: inputUrl ?? '',
            platformId
        }
    }

    if (overrides) {
        page.schema.properties = overrides.schema.properties;
        page.uiSchema = overrides.uiSchema;
    }
    return page;
}

exports.getHostnameInputPageRender = getHostnameInputPageRender;