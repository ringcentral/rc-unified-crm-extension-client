function getCustomSettingsPageRender({ crmManifest, adminUserSettings, userSettings }) {
    if (!crmManifest?.settings) {
        return null;
    }
    let page =
    {
        id: 'customSettingsPage',
        title: 'Custom Settings',
        type: 'page',
        schema: {
            type: 'object',
            required: [],
            properties: {
            }
        },
        uiSchema: {
            submitButtonOptions: {
                submitText: 'Save',
            },
        },
        formData: {
        }
    }
    for (const section of crmManifest.settings) {
        // Skip sections that should appear in Activity logging admin page
        // if (section.section === 'activityLogging') {
        //     continue;
        // }

        page.schema.properties[section.id] = {
            type: 'string',
            description: section.name
        }
        page.uiSchema[section.id] = {
            "ui:field": "typography",
            "ui:variant": "title2"
        }
        for (const setting of section.items) {
            switch (setting.type) {
                case 'warning':
                    page.schema.properties[setting.id] = {
                        type: 'string',
                        description: setting.value
                    };
                    page.uiSchema[setting.id] = {
                        "ui:field": "admonition",
                        "ui:severity": "warning"
                    }
                    break;
                case 'inputField':
                case 'boolean':
                    page.schema.properties[setting.id] = {
                        type: 'object',
                        title: setting.name,
                        properties: {
                            customizable: {
                                type: 'boolean',
                                title: 'Customizable by user'
                            },
                            value: {
                                type: setting.type === 'inputField' ? 'string' : 'boolean',
                                title: setting.name
                            }
                        }
                    };
                    page.formData[setting.id] = {
                        customizable: adminUserSettings?.[setting.id]?.customizable ?? true,
                        value: adminUserSettings?.[setting.id]?.value ?? setting.defaultValue
                    };
                    page.uiSchema[setting.id] = {
                        "ui:collapsible": true,
                    }
                    break;
                case 'option':
                    page.formData[setting.id] = {
                        customizable: adminUserSettings?.[setting.id]?.customizable ?? true,
                        value: adminUserSettings?.[setting.id]?.value ?? setting?.defaultValue
                    };
                    if (setting.dynamicOptions) {
                        page.formData[setting.id].options = userSettings?.[setting.id]?.options ?? [];
                    }
                    page.uiSchema[setting.id] = {
                        "ui:collapsible": true,
                    }
                    if (setting.checkbox) {
                        page.schema.properties[setting.id] = {
                            type: 'object',
                            title: setting.name,
                            properties: {
                                customizable: {
                                    type: 'boolean',
                                    title: 'Customizable by user'
                                },
                                value: {
                                    type: 'array',
                                    title: setting.name,
                                    items: {
                                        type: 'string',
                                        enum: setting.dynamicOptions ? userSettings?.[setting.id]?.options?.map(option => option.id) : setting.options.map(option => option.id),
                                        enumNames: setting.dynamicOptions ? userSettings?.[setting.id]?.options?.map(option => option.name) : setting.options.map(option => option.name)
                                    },
                                    uniqueItems: true
                                }
                            }
                        }
                        page.uiSchema[setting.id].value = {
                            'ui:widget': 'checkboxes',
                            'ui:options': {
                                inline: true,
                            },
                        };
                    }
                    else {
                        page.schema.properties[setting.id] = {
                            type: 'object',
                            title: setting.name,
                            properties: {
                                customizable: {
                                    type: 'boolean',
                                    title: 'Customizable by user'
                                },
                                value: {
                                    type: 'string',
                                    title: setting.name,
                                    oneOf: setting.dynamicOptions ? userSettings?.[setting.id]?.options?.map(option => ({
                                        const: option.id,
                                        title: option.name
                                    })) : setting.options.map(option => ({
                                        const: option.id,
                                        title: option.name
                                    }))
                                }
                            }
                        };
                    }
                    break;
            }
        }
    }
    return page;
}
exports.getCustomSettingsPageRender = getCustomSettingsPageRender;