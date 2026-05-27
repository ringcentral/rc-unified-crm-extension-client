function getAdvancedFeaturesSettingPageRender({ adminUserSettings }) {
    const page =
    {
        id: 'advancedFeaturesSettingPage',
        title: 'Advanced Features',
        type: 'page',
        schema: {
            type: 'object',
            required: [],
            properties: {
                autoOpenExtension: {
                    type: 'object',
                    title: 'Auto-open extension',
                    properties: {
                        customizable: {
                            type: 'boolean',
                            title: 'Customizable by user'
                        },
                        value: {
                            type: 'boolean',
                            title: 'Value'
                        }
                    }
                },
                developerMode: {
                    type: 'object',
                    title: 'Developer mode',
                    properties: {
                        customizable: {
                            type: 'boolean',
                            title: 'Customizable by user'
                        },
                        value: {
                            type: 'boolean',
                            title: 'Value'
                        }
                    }
                },
                c2dIgnoreSelector: {
                    type: 'object',
                    title: 'Click-to-dial ignore selector',
                    description: 'CSS selector for page areas where click-to-dial should not detect phone numbers.',
                    properties: {
                        customizable: {
                            type: 'boolean',
                            title: 'Customizable by user'
                        },
                        value: {
                            type: 'string',
                            title: 'Selector'
                        }
                    }
                }
            }
        },
        uiSchema: {
            autoOpenExtension: {
                "ui:collapsible": true,
            },
            developerMode: {
                "ui:collapsible": true,
            },
            c2dIgnoreSelector: {
                "ui:collapsible": true,
            },
            submitButtonOptions: {
                submitText: 'Save',
            },
        },
        formData: {
            autoOpenExtension:
            {
                customizable: adminUserSettings?.autoOpenExtension?.customizable ?? true,
                value: adminUserSettings?.autoOpenExtension?.value ?? false
            },
            developerMode:
            {
                customizable: adminUserSettings?.developerMode?.customizable ?? true,
                value: adminUserSettings?.developerMode?.value ?? false
            },
            c2dIgnoreSelector:
            {
                customizable: adminUserSettings?.c2dIgnoreSelector?.customizable ?? true,
                value: adminUserSettings?.c2dIgnoreSelector?.value ?? ''
            }
        }
    }
    return page;
}
exports.getAdvancedFeaturesSettingPageRender = getAdvancedFeaturesSettingPageRender;
