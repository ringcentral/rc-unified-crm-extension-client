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
            if (field.type === 'selection' && field.oneOf) {
                schemaProp.properties.value.oneOf = field.oneOf;
            }
            customFormProperties[key] = schemaProp;
            customFormUiSchema[key] = {
                "ui:collapsible": true,
            }
            if (field.type === 'selection') {
                customFormUiSchema[key].value = {
                    "ui:widget": "select",
                }
            }
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