type UnknownRecord = Record<string, any>;

function getManagedAuthUserEditPageRender({
    userFields = [],
    userValues = [],
    rcExtension,
    formData = {},
    searchWord = '',
    filter = 'All'
}: UnknownRecord): UnknownRecord {
    const nextFormData: UnknownRecord = {
        ...(formData ?? {})
    };
    const selectedEntry = userValues.find((user: UnknownRecord) => user.rcExtensionId === rcExtension?.id) ?? null;
    const properties: UnknownRecord = {
        rcExtensionId: {
            type: 'string',
            const: rcExtension?.id ?? '',
            description: rcExtension?.name || `${rcExtension?.firstName ?? ''} ${rcExtension?.lastName ?? ''}`.trim() || rcExtension?.id || ''
        }
    };
    const uiSchema: UnknownRecord = {
        rcExtensionId: {
            'ui:field': 'typography',
            'ui:variant': 'body2'
        },
        submitButtonOptions: {
            submitText: 'Save'
        }
    };

    userFields.forEach((field: UnknownRecord) => {
        const storedValue = selectedEntry?.fields?.[field.const] ?? {};
        const hasFormValue = Object.prototype.hasOwnProperty.call(nextFormData, field.const);
        properties[field.const] = {
            title: field.title,
            type: field.type,
            description: field.description
        };
        uiSchema[field.const] = field.uiSchema ?? {};
        if (!hasFormValue && storedValue.hasValue) {
            nextFormData[field.const] = storedValue.value;
        }
    });

    return {
        id: 'managedAuthUserEditPage',
        title: `Edit managed auth for ${properties.rcExtensionId.description}`,
        type: 'page',
        schema: {
            type: 'object',
            properties
        },
        uiSchema,
        formData: {
            ...nextFormData,
            rcExtensionId: rcExtension?.id ?? '',
            rcExtensionName: properties.rcExtensionId.description,
            searchWord,
            filter
        }
    };
}

export { getManagedAuthUserEditPageRender };
export default {
    getManagedAuthUserEditPageRender,
};
