function getGeneralSettingPageRender() {
    return {
        id: 'generalSettings',
        title: 'General',
        type: 'page',
        schema: {
            type: 'object',
            required: [],
            properties: {
                section: {
                    type: "string",
                    oneOf: [
                        {
                            const: "customizeTabs",
                            title: "Customize tabs"
                        },
                        {
                            const: "notificationLevel",
                            title: "Notification level"
                        },
                        {
                            const: "urlWhitelist",
                            title: "URL whitelist"
                        }
                    ]
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

exports.getGeneralSettingPageRender = getGeneralSettingPageRender;