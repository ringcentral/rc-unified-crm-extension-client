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
                showAiAssistantWidget:{
                    type: 'object',
                    title: 'AI assistant widget',
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
                autoStartAiAssistant: {
                    type: 'object',
                    title: 'Auto-start AI assistant',
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
            showAiAssistantWidget: {
                "ui:collapsible": true,
            },
            autoStartAiAssistant: {
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
            showAiAssistantWidget:
            {
                customizable: adminUserSettings?.showAiAssistantWidget?.customizable ?? true,
                value: adminUserSettings?.showAiAssistantWidget?.value ?? false
            },
            autoStartAiAssistant:
            {
                customizable: adminUserSettings?.autoStartAiAssistant?.customizable ?? true,
                value: adminUserSettings?.autoStartAiAssistant?.value ?? false
            }
        }
    }
    return page;
}
exports.getAdvancedFeaturesSettingPageRender = getAdvancedFeaturesSettingPageRender;