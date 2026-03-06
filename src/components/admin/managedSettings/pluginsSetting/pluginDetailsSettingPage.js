function getPluginDetailsSettingPageRender({ pluginId, pluginDetails }) {
    const customForm = pluginDetails.pageContent;
    let customFormProperties = {};
    let customFormUiSchema = {};
    if (customForm) {
        for (const field of customForm) {
            const key = field.const;
            const schemaProp = {
                type: 'object',
                title: field.title,
                properties: {
                    value: {
                        type: field.type === 'selection' ? 'string' : field.type,
                        title: field.title
                    },
                    customizable: {
                        type: 'boolean',
                        title: 'Customizable by user'
                    }
                }
            }
            if (field.type === 'selection' && field.oneOf) {
                schemaProp.properties.value.oneOf = field.oneOf;
            }
            customFormProperties[`${pluginId}_${key}Setting`] = schemaProp;
            customFormUiSchema[`${pluginId}_${key}Setting`] = {
                "ui:collapsible": true,
            }
            if (field.type === 'selection') {
                customFormUiSchema[`${pluginId}_${key}Setting`].value = {
                    "ui:widget": "select",
                }
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
        }
    }
}

exports.getPluginDetailsSettingPageRender = getPluginDetailsSettingPageRender;