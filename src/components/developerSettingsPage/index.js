import { t } from '../../i18n';

function getDeveloperSettingsPageRender() {
    const developerSettingsPage = {
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
    return developerSettingsPage;
}

exports.getDeveloperSettingsPageRender = getDeveloperSettingsPageRender;