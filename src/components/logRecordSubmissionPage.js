function getLogRecordSubmissionPageRender({ issueDescription, piiConsent, email }) {
    return {
        id: 'logRecordSubmissionPage',
        title: 'Log Record Submission',
        type: 'page',
        schema: {
            type: 'object',
            properties: {
                piiConsent: {
                    type: 'boolean',
                    title: ' ',
                    description: 'I consent to the collection and use of my personal information for issue resolving purposes'
                },
                email: {
                    type: 'string',
                    title: 'Email',
                },
                issueDescription: {
                    type: 'string',
                    title: 'Issue Description',
                },
                logRecordSubmitButton: {
                    type: 'string',
                    title: 'Submit'
                }
            }
        },
        uiSchema: {
            piiConsent: {
                "ui:field": "checkbox",
                "ui:variant": "body1"
            },
            email: {
                "ui:placeholder": 'Enter email here...',
            },
            issueDescription: {
                "ui:placeholder": 'Enter issue description here...',
                "ui:widget": "textarea",
            },
            logRecordSubmitButton: {
                "ui:field": "button",
                "ui:variant": "contained",
                "ui:fullWidth": true,
                "ui:disabled": !issueDescription || !piiConsent || !email
            }
        },
        formData: {
            issueDescription: issueDescription ?? '',
            piiConsent: piiConsent ?? false,
            email: email ?? ''
        }
    }
}

exports.getLogRecordSubmissionPageRender = getLogRecordSubmissionPageRender;