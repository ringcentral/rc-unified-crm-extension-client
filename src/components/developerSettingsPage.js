function getDeveloperSettingsPageRender({ customUrl, isAdmin }) {
    const developerSettingsPage = {
        id: 'developerSettingsPage',
        title: 'Developer settings',
        type: 'page',
        schema: {
            type: 'object',
            properties: {
                customManifestWarning: {
                    type: "string",
                    description: "Please be careful that a custom url is not trusted by RingCentral."
                },
                customManifestUrl: {
                    type: "string",
                    title: "Custom manifest URL"
                },
                clearPlatformInfoWarning: {
                    type: "string",
                    description: "This will clear current CRM platform information so to be re-initialized with a new CRM platform."
                },
                clearPlatformInfoButton: {
                    type: "string",
                    title: "Clear platform info"
                }
            }
        },
        uiSchema: {
            customManifestWarning: {
                "ui:field": "admonition",
                "ui:severity": "warning",  // "warning", "info", "error", "success"
            },
            submitButtonOptions: {
                submitText: 'Submit'
            },
            customManifestUrl: {
                "ui:placeholder": 'Enter url...',
            },
            clearPlatformInfoWarning: {
                "ui:field": "admonition",
                "ui:severity": "warning",  // "warning", "info", "error", "success"
            },
            clearPlatformInfoButton: {
                "ui:field": "button",
                "ui:variant": "contained", // "text", "outlined", "contained", "plain"
                "ui:fullWidth": false
            }
        },
        formData: {
            customManifestUrl: customUrl
        }
    }
    if (isAdmin) {
        developerSettingsPage.schema.properties.reinitializeUserMappingWarning = {
            type: "string",
            description: "This will clear all user mapping and initialize them by user profile name match between RingCentral and CRM platform."
        }
        developerSettingsPage.schema.properties.reinitializeUserMappingButton = {
            type: "string",
            title: "Re-initialize user mapping"
        }
        developerSettingsPage.uiSchema.reinitializeUserMappingWarning = {
            "ui:field": "admonition",
            "ui:severity": "warning",  // "warning", "info", "error", "success"
        }
        developerSettingsPage.uiSchema.reinitializeUserMappingButton = {
            "ui:field": "button",
            "ui:variant": "contained", // "text", "outlined", "contained", "plain"
            "ui:fullWidth": false
        }
    }
    return developerSettingsPage;
}

exports.getDeveloperSettingsPageRender = getDeveloperSettingsPageRender;