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

    // Also surface overriding number format here (previously under Managed settings -> Call-pop)
    if (adminUserSettings?.overridingNumberFormat) {
        page.schema.properties.overridingNumberFormatTitle = {
            type: 'string',
            description: 'Overriding number format'
        }
        page.uiSchema.overridingNumberFormatTitle = {
            "ui:field": "typography",
            "ui:variant": "title2"
        }
        page.schema.properties.overridingNumberFormatWarning = {
            type: 'string',
            description: "Please input your overriding phone number format: (please use # to represent a number digit, eg. (###) ###-###)",
        };
        page.uiSchema.overridingNumberFormatWarning = {
            "ui:field": "admonition",
            "ui:severity": "warning"
        }

        page.schema.properties.overridingNumberFormatCustomizable = {
            type: 'boolean',
            title: 'Customizable by user'
        }
        page.formData.overridingNumberFormatCustomizable = adminUserSettings?.overridingNumberFormat?.customizable ?? true;

        const buildFormatterField = (id, title, value) => {
            page.schema.properties[id] = {
                type: 'string',
                title,
            };
            page.formData[id] = value ?? '';
        }

        buildFormatterField('overridingNumberFormat1', 'Format 1', adminUserSettings?.overridingNumberFormat?.numberFormatter1);
        buildFormatterField('overridingNumberFormat2', 'Format 2', adminUserSettings?.overridingNumberFormat?.numberFormatter2);
        buildFormatterField('overridingNumberFormat3', 'Format 3', adminUserSettings?.overridingNumberFormat?.numberFormatter3);
    }
    return page;
}
exports.getCustomSettingsPageRender = getCustomSettingsPageRender;