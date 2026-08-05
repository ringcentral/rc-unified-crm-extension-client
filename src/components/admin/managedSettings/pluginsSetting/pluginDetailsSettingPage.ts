type UnknownRecord = Record<string, any>;

function getPluginDetailsSettingPageRender({ pluginId, pluginDetails, pluginSetting }: UnknownRecord): UnknownRecord {
    const customForm = pluginDetails.pageContent;
    let customFormProperties: UnknownRecord = {};
    let customFormUiSchema: UnknownRecord = {};
    const formData: UnknownRecord = {
        pluginId,
        hiddenConfigFields: []
    };
    if (customForm) {
        for (const field of customForm) {
            const key = field.const;
            const isHidden = field.hidden === true;
            const schemaProp: UnknownRecord = {
                type: 'object',
                title: field.title,
                properties: {
                    value: {
                        type: field.type === 'selection' ? 'string' : field.type,
                        title: field.title,
                        defaultValue: null
                    }
                }
            }
            if (!isHidden) {
                schemaProp.properties.customizable = {
                    type: 'boolean',
                    title: 'Customizable by user',
                    defaultValue: true
                };
            }
            else {
                schemaProp.properties.customizable = {
                    type: 'boolean',
                    title: 'Customizable by user',
                    defaultValue: false
                };
            }
            customFormUiSchema[key] = {
                "ui:collapsible": true,
            }
            if (isHidden) {
                customFormUiSchema[key].customizable = {
                    "ui:widget": "hidden",
                };
            }
            if (isHidden) {
                formData.hiddenConfigFields.push(key);
            }
            // special case: single selection or multi selection
            // Multi
            if (field.type === 'selection' && field.multiSelect) {
                schemaProp.properties.value.type = 'array';
                schemaProp.properties.value.items = {
                    type: 'string',
                    enum: field.oneOf.map((option: UnknownRecord) => option.const),
                    enumNames: field.oneOf.map((option: UnknownRecord) => option.title)
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
                customizable: isHidden ? false : pluginSetting?.config?.[key]?.customizable ?? true,
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

export { getPluginDetailsSettingPageRender };
export default {
    getPluginDetailsSettingPageRender,
};
