import { t } from '../../i18n';

function getManagedSettingsPageRender({ crmManifest }) {
    let page = {
        id: 'managedSettings',
        title: t('pages.managedSettings.title'),
        type: 'page',
        schema: {
            type: 'object',
            reuiqred: [],
            properties: {
                section: {
                    type: "string",
                    oneOf: [{
                        const: "generalSettings",
                        title: t('pages.managedSettings.general')
                    },
                    ...(crmManifest.name === 'googleSheets' ? [{
                        const: "googleSheetsAdminConfig",
                        title: t('pages.managedSettings.googleSheetsConfig'),
                    }] : []),
                    {
                        const: "callAndSMSLogging",
                        title: t('pages.managedSettings.activityLogging')
                    },
                    {
                        const: "contactSetting",
                        title: t('pages.managedSettings.callPop')
                    },
                    {
                        const: "plugins",
                        title: t('pages.managedSettings.plugins'),
                    },
                    {
                        const: "advancedFeaturesSetting",
                        title: t('pages.managedSettings.advancedFeatures')
                    }]
                }
            }
        },
        uiSchema: {
            section: {
                "ui:field": "list",
                "ui:navigation": true,
            }
        }
    }

    if (crmManifest?.settings) {
        page.schema.properties.section.oneOf.push({
            const: "customSettings",
            title: t('pages.managedSettings.customSettings')
        });
    }
    return page;
}

exports.getManagedSettingsPageRender = getManagedSettingsPageRender;