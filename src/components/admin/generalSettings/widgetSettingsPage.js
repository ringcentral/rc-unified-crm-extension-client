function getWidgetSettingsPageRender({ adminUserSettings }) {
    return {
        id: 'widgetSettingsPage',
        title: 'Widget settings',
        type: 'page',
        schema: {
            type: 'object',
            required: [],
            properties: {
                quickAccessButtonSize: {
                    type: 'object',
                    title: 'Quick access button size',
                    properties: {
                        customizable: {
                            type: 'boolean',
                            title: 'Customizable by user'
                        },
                        value: {
                            type: 'string',
                            title: 'Value',
                            oneOf: [
                                { const: 'small', title: 'Small' },
                                { const: 'medium', title: 'Medium' },
                                { const: 'large', title: 'Large' },
                                { const: 'xlarge', title: 'Extra Large' }
                            ]
                        }
                    }
                }
            }
        },
        uiSchema: {
            quickAccessButtonSize: {
                "ui:collapsible": true,
            },
            submitButtonOptions: {
                submitText: 'Save',
            }
        },
        formData: {
            quickAccessButtonSize: {
                customizable: adminUserSettings?.quickAccessButtonSize?.customizable ?? true,
                value: adminUserSettings?.quickAccessButtonSize?.value ?? 'large'
            }
        }
    }
}

exports.getWidgetSettingsPageRender = getWidgetSettingsPageRender;

