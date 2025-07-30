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
                            const: "appearance",
                            title: "Appearance"
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

exports.getGeneralSettingPageRender = getGeneralSettingPageRender;