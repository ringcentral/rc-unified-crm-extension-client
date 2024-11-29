function getCustomSettingsPageRender({ crmManifest, adminUserSettings }) {
    if (!!!crmManifest?.settings) {
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
            }
        }
    }
    return page;
}
exports.getCustomSettingsPageRender = getCustomSettingsPageRender;