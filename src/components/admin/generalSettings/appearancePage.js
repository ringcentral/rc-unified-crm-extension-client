function getAppearancePageRender() {
    return {
        id: 'appearancePage',
        title: 'Appearance',
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
                            const: "clickToDialEmbed",
                            title: "Enabled domains"
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

exports.getAppearancePageRender = getAppearancePageRender; 