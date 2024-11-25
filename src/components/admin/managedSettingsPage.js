function getManagedSettingsPageRender() {
    return {
        id: 'managedSettings',
        title: 'Managed settings',
        type: 'page',
        schema: {
            type: 'object',
            reuiqred: [],
            properties: {
                section:{
                    type: "string",
                    oneOf: [{
                        const: "callAndSMSLogging",
                        title: "Call and SMS logging",
                    }, {
                        const: "contacts",
                        title: "Contacts",
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
}

exports.getManagedSettingsPageRender = getManagedSettingsPageRender;