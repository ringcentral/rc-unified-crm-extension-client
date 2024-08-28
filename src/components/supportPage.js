function getSupportPageRender({ manifest, isOnline }) {
    const supportPage = {
        id: 'supportPage',
        title: 'Support',
        type: 'page',
        schema: {
            type: 'object',
            properties: {
                documentation: {
                    type: "string",
                    description: "Documentation"
                },
                releaseNotes: {
                    type: "string",
                    description: "Release notes"
                },
                getSupport: {
                    type: "string",
                    description: "Get support"
                },
                writeReview: {
                    type: "string",
                    description: "Write a review"
                },
                openFeedbackPageButton: {
                    type: "string",
                    description: "Share a feature request",
                },
                version: {
                    type: "string",
                    description: `Version: v${manifest.version}`
                },
                checkForUpdateButton: {
                    type: "string",
                    title: "Check for update",
                },
                isServiceOnline: {
                    type: "string",
                    description: `Server status: ${isOnline ? 'Online' : 'Offline'}`
                },
                generateErrorLogButton: {
                    type: "string",
                    title: "Download error log",
                },
                factoryResetWarning: {
                    type: "string",
                    description: "Factory reset will disconnect both CRM and RingCentral accounts from this extension and log you out."
                },
                factoryResetButton: {
                    type: "string",
                    title: "Factory reset",
                }
            }
        },
        uiSchema: {
            documentation: {
                "ui:field": "link",
                "ui:variant": "body1",
                "ui:underline": true
            },
            releaseNotes: {
                "ui:field": "link",
                "ui:variant": "body1",
                "ui:underline": true
            },
            getSupport: {
                "ui:field": "link",
                "ui:variant": "body1",
                "ui:underline": true
            },
            writeReview: {
                "ui:field": "link",
                "ui:variant": "body1",
                "ui:underline": true
            },
            openFeedbackPageButton: {
                "ui:field": "link",
                "ui:variant": "body1",
                "ui:underline": true
            },
            version: {
                "ui:field": "typography",
                "ui:variant": "body2", // "caption1", "caption2", "body1", "body2", "subheading2", "subheading1", "title2", "title1"
                "ui:align": "center"
            },
            checkForUpdateButton: {
                "ui:field": "button",
                "ui:variant": "outlined", // "text", "outlined", "contained", "plain"
                "ui:fullWidth": false
            },
            isServiceOnline: {
                "ui:field": "typography",
                "ui:variant": "body2", // "caption1", "caption2", "body1", "body2", "subheading2", "subheading1", "title2", "title1"
            },
            generateErrorLogButton: {
                "ui:field": "button",
                "ui:variant": "outlined", // "text", "outlined", "contained", "plain"
                "ui:fullWidth": false
            },
            factoryResetWarning: {
                "ui:field": "admonition",
                "ui:severity": "warning",  // "warning", "info", "error", "success"
            },
            factoryResetButton: {
                "ui:field": "button",
                "ui:variant": "outlined", // "text", "outlined", "contained", "plain"
                "ui:fullWidth": false,
                "ui:color": "danger.b03"
            },
        }
    }
    return supportPage;
}

exports.getSupportPageRender = getSupportPageRender;