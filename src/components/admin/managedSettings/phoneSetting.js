function getPhoneSettingPageRender({ adminUserSettings }) {
    let page = {
        id: 'phoneSettingPage',
        title: 'Phone',
        type: 'page',
        schema: {
            type: 'object',
            required: [],
            properties: {
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
            submitButtonOptions: {
                submitText: 'Save',
            },
            autoStartAiAssistant: {
                "ui:collapsible": true,
            }
        },
        formData: {
            autoStartAiAssistant:
            {
                customizable: adminUserSettings?.autoStartAiAssistant?.customizable ?? true,
                value: adminUserSettings?.autoStartAiAssistant?.value ?? false
            }
        }
    }
    return page;
}

exports.getPhoneSettingPageRender = getPhoneSettingPageRender;