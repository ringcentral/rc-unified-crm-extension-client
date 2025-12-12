function getErrorLogRecordPageRender({ step = 1, email, issueDescription = '' }) {
    let page = {};
    switch (step) {
        case 1:
            return {
                id: 'errorLogRecordPage',
                title: `Error Log Record`,
                description: `Error Log Record`,
                schema: {
                    type: 'object',
                    properties: {
                        userEmailTitle: {
                            type: 'string',
                            description: 'Email',
                        },
                        userEmail: {
                            type: 'string',
                            title: 'Email',
                            description: email ?? ''
                        },
                        issueDescription: {
                            type: 'string',
                            title: 'Issue Description',
                        },
                        getErrorLogRecordPageNextStepButton: {
                            type: 'string',
                            title: 'Next',
                        }
                    }
                },
                uiSchema: {
                    userEmailTitle: {
                        "ui:field": "typography"
                    },
                    userEmail: {
                        "ui:field": "typography",
                        "ui:variant": "body2",
                        "ui:style": { marginTop: "-10px" }
                    },
                    issueDescription: {
                        "ui:placeholder": 'Enter issue description here...',
                        "ui:widget": "textarea",
                    },
                    getErrorLogRecordPageNextStepButton: {
                        "ui:field": "button",
                        "ui:variant": "contained",
                        "ui:fullWidth": true,
                        "ui:disabled": !issueDescription
                    }
                },
                formData: {
                    issueDescription: issueDescription ?? '',
                    email: email ?? '',
                }
            }
        case 2:
            return {
                id: 'errorLogRecordPage',
                title: `Reproduce issue`,
                description: `Reproduce issue`,
                schema: {
                    type: 'object',
                    properties: {
                        instructionTitle: {
                            type: 'string',
                            description: 'To complete your problem report, click the "Record session" button below and reproduce the problem described in the previous step. While recording we will capture key details to help us resolve your issue.'
                        },
                        errorLogRecordPageStartButton: {
                            type: 'string',
                            title: 'Record session',
                        }
                    }
                },
                uiSchema: {
                    instructionTitle: {
                        "ui:field": "typography"
                    },
                    errorLogRecordPageStartButton: {
                        "ui:field": "button",
                        "ui:variant": "contained",
                        "ui:fullWidth": true
                    }
                }
            }
        case 3:
            return {
                id: 'errorLogRecordPage',
                title: `Recording in process`,
                description: `Recording in process`,
                schema: {
                    type: 'object',
                    properties: {
                        instructionTitle: {
                            type: 'string',
                            description: 'You can safely navigate away from this page. Reproduce your problem and click "Stop" when you are done.'
                        },
                    }
                },
                uiSchema: {
                    instructionTitle: {
                        "ui:field": "typography"
                    }
                }
            }
    }
}

exports.getErrorLogRecordPageRender = getErrorLogRecordPageRender;