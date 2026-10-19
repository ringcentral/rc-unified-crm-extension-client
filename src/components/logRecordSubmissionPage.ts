type UnknownRecord = Record<string, any>;

function getLogRecordSubmissionPageRender({ piiConsent }: UnknownRecord): UnknownRecord {
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
                    description: 'I consent to sharing my App Connect session, which may contain sensitive information.'
                },
                logRecordSubmitButton: {
                    type: 'string',
                    title: 'Send error report'
                }
            }
        },
        uiSchema: {
            piiConsent: {
                "ui:field": "checkbox",
                "ui:variant": "body1"
            },
            logRecordSubmitButton: {
                "ui:field": "button",
                "ui:variant": "contained",
                "ui:fullWidth": true,
                "ui:disabled": !piiConsent
            }
        },
        formData: {
            piiConsent: piiConsent ?? false
        }
    }
}

export { getLogRecordSubmissionPageRender };
export default {
    getLogRecordSubmissionPageRender,
};
