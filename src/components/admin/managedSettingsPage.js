function getManagedSettingsPageRender({ crmManifest }) {
    let page = {
        id: 'managedSettings',
        title: 'Managed settings',
        type: 'page',
        schema: {
            type: 'object',
            reuiqred: [],
            properties: {
                section: {
                    type: "string",
                    oneOf: [{
                        const: "generalSettings",
                        title: "General"
                    },
                    {
                        const: "callAndSMSLogging",
                        title: "Call and SMS logging"
                    },
                    {
                        const: "contactSetting",
                        title: "Call-pop"
                    },
                    {
                        const: "advancedFeaturesSetting",
                        title: "Advanced features"
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
            title: "Custom settings"
        });
    }
    return page;
}

exports.getManagedSettingsPageRender = getManagedSettingsPageRender;