function getPluginDetailsSettingPageRender({ pluginId, pluginDetails, pluginSetting }) {
    const customForm = pluginDetails.pageContent;
    let customFormProperties = {};
    let customFormUiSchema = {};
    const formData = {
        pluginId
    };
    if (customForm) {
        for (const field of customForm) {
            const key = field.const;
            const schemaProp = {
                type: 'object',
                title: field.title,
                properties: {
                    value: {
                        type: field.type === 'selection' ? 'string' : field.type,
                        title: field.title,
                        defaultValue: null
                    },
                    customizable: {
                        type: 'boolean',
                        title: 'Customizable by user',
                        defaultValue: true
                    }
                }
            }
            customFormUiSchema[key] = {
                "ui:collapsible": true,
            }
            // special case: single selection or multi selection
            // Multi
            if (field.type === 'selection' && field.multiSelect) {
                schemaProp.properties.value.type = 'array';
                schemaProp.properties.value.items = {
                    type: 'string',
                    enum: field.oneOf.map(option => option.const),
                    enumNames: field.oneOf.map(option => option.title)
                };
                schemaProp.properties.value.uniqueItems = true;
                customFormUiSchema[key].value = {
                    "ui:widget": "checkboxes",
                }
            }
            // Single
            else {
                if (field.oneOf) {
                    schemaProp.properties.value.oneOf = field.oneOf;
                    customFormUiSchema[key].value = {
                        "ui:widget": "select",
                    }
                }
            }
            customFormProperties[key] = schemaProp;
            formData[key] = {
                customizable: pluginSetting?.config?.[key]?.customizable ?? true,
                value: pluginSetting?.config?.[key]?.value ?? null
            }
        }
    }
    return {
        id: 'pluginDetailsSettingPage',
        title: pluginDetails.displayName,
        type: 'page',
        schema: {
            type: 'object',
            properties: {
                ...customFormProperties
            }
        },
        uiSchema: {
            submitButtonOptions: {
                submitText: 'Save',
            },
            ...customFormUiSchema
        },
        formData
    }
}

exports.getPluginDetailsSettingPageRender = getPluginDetailsSettingPageRender;