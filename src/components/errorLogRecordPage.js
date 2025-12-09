function getErrorLogRecordPageRender({ consent }) {
    return {
        id: 'errorLogRecordPage',
        title: `Error Log Record`,
        description: `Error Log Record`,
        schema: {
            type: 'object',
            properties: {
                instructionTitle: {
                    type: 'string',
                    description: 'Please follow instructions below to report an issue:'
                },
                instruction1: {
                    type: 'string',
                    description: '1. Fill in the form below and press "Start" button'
                },
                instruction2: {
                    type: 'string',
                    description: '2. Reproduce the issue inside App Connect extension'
                },
                instruction3: {
                    type: 'string',
                    description: '3. Click "Stop" button and submit the form'
                },
                piiConsent: {
                    type: 'boolean',
                    title: ' ',
                    description: 'I consent to the collection and use of my personal information for issue resolving purposes'
                },
                errorLogRecordPageStartButton: {
                    type: 'string',
                    title: 'Start'
                }
            }
        },
        uiSchema: {
            instructionTitle: {
                "ui:field": "typography",
                "ui:variant": "body2"
            },
            instruction1: {
                "ui:field": "typography",
                "ui:variant": "body1",
                "ui:style": { margin: '-15px 0px 0px 20px' }
            },
            instruction2: {
                "ui:field": "typography",
                "ui:variant": "body1",
                "ui:style": { margin: '-15px 0px 0px 20px' }
            },
            instruction3: {
                "ui:field": "typography",
                "ui:variant": "body1",
                "ui:style": { margin: '-15px 0px 0px 20px' }
            },
            piiConsent: {
                "ui:field": "checkbox",
                "ui:variant": "body1"
            },
            errorLogRecordPageStartButton: {
                "ui:field": "button",
                "ui:variant": "contained",
                "ui:fullWidth": false,
                "ui:disabled": !consent
            }
        },
        formData: {
            piiConsent: consent
        }
    }
}

exports.getErrorLogRecordPageRender = getErrorLogRecordPageRender;