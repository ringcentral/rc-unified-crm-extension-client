import { t } from '../../i18n';

type UnknownRecord = Record<string, any>;

function getDeveloperSettingsPageRender({ isAdmin }: UnknownRecord): UnknownRecord {
    const developerSettingsPage: UnknownRecord = {
        id: 'developerSettingsPage',
        title: t('pages.developerSettings.title'),
        type: 'page',
        schema: {
            type: 'object',
            properties: {
                clearPlatformInfoWarning: {
                    type: "string",
                    description: t('pages.developerSettings.clearPlatformInfoWarning')
                },
                clearPlatformInfoButton: {
                    type: "string",
                    title: t('pages.developerSettings.clearPlatformInfo')
                },
                openImplementedInterfacesPageButton: {
                    type: "string",
                    title: t('pages.developerSettings.checkInterfaceImplementations')
                }
            }
        },
        uiSchema: {
            // submitButtonOptions: {
            //     submitText: 'Submit'
            // },
            clearPlatformInfoWarning: {
                "ui:field": "admonition",
                "ui:severity": "warning",  // "warning", "info", "error", "success"
            },
            clearPlatformInfoButton: {
                "ui:field": "button",
                "ui:variant": "contained", // "text", "outlined", "contained", "plain"
                "ui:fullWidth": false
            },
            openImplementedInterfacesPageButton: {
                "ui:field": "button",
                "ui:variant": "contained", // "text", "outlined", "contained", "plain"
                "ui:fullWidth": false
            }
        },
        formData: {
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

export { getDeveloperSettingsPageRender };
export default {
    getDeveloperSettingsPageRender,
};
