function getNotificationLevelSettingPageRender({ adminUserSettings }) {
    return {
        id: 'notificationLevelSettingPage',
        title: 'Notification level setting',
        type: 'page',
        schema: {
            type: 'object',
            required: [],
            properties: {
                notificationLevelSetting: {
                    type: 'object',
                    title: 'Notification level',
                    properties: {
                        customizable: {
                            type: 'boolean',
                            title: 'Customizable by user'
                        },
                        value: {
                            type: 'array',
                            title: 'Value',
                            items: {
                                type: 'string',
                                enum: ['success', 'warning', 'error']
                            },
                            uniqueItems: true
                        }
                    }
                }
            }
        },
        uiSchema: {
            notificationLevelSetting: {
                "ui:collapsible": true,
                value: {
                    "ui:widget": "checkboxes"
                }
            },
            submitButtonOptions: {
                submitText: 'Save',
            }
        },
        formData: {
            notificationLevelSetting: {
                customizable: adminUserSettings?.notificationLevelSetting?.customizable ?? true,
                value: adminUserSettings?.notificationLevelSetting?.value ?? ['success', 'warning', 'error']
            }
        }
    }
}

exports.getNotificationLevelSettingPageRender = getNotificationLevelSettingPageRender;