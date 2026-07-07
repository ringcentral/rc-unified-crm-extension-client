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
                            const: "widgetSettings",
                            title: "Widget settings"
                        },
                        {
                            const: "notificationLevel",
                            title: "Notification level"
                        },
                        {
                            const: "phoneNumberFormat",
                            title: "Phone number format"
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

export { getAppearancePageRender };
export default {
    getAppearancePageRender,
};
