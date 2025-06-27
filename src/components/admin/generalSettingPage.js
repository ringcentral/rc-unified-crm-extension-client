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