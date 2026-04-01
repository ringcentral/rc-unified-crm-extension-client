function getSharedAuthUserEditPageRender({
    userFields = [],
    userValues = [],
    rcExtension,
    formData = {},
    searchWord = '',
    filter = 'All'
}) {
    const nextFormData = {
        ...(formData ?? {})
    };
    const selectedEntry = userValues.find((user) => user.rcExtensionId === rcExtension?.id) ?? null;
    const properties = {
        rcExtensionId: {
            type: 'string',
            const: rcExtension?.id ?? '',
            description: rcExtension?.name || `${rcExtension?.firstName ?? ''} ${rcExtension?.lastName ?? ''}`.trim() || rcExtension?.id || ''
        }
    };
    const uiSchema = {
        rcExtensionId: {
            'ui:field': 'typography',
            'ui:variant': 'body2'
        },
        submitButtonOptions: {
            submitText: 'Save'
        }
    };

    userFields.forEach((field) => {
        const storedValue = selectedEntry?.fields?.[field.const] ?? {};
        const hasFormValue = Object.prototype.hasOwnProperty.call(nextFormData, field.const);
        properties[field.const] = {
            title: field.title,
            type: field.type,
            description: storedValue.hasValue && field.confidential
                ? `${field.description ?? ''}${field.description ? ' ' : ''}Stored value is hidden. Enter a new value to replace it.`
                : field.description
        };
        uiSchema[field.const] = field.uiSchema ?? {};
        if (field.confidential && storedValue.hasValue) {
            uiSchema[field.const]['ui:widget'] = 'password';
        }
        if (!hasFormValue && storedValue.hasValue) {
            nextFormData[field.const] = storedValue.value;
        }
    });

    return {
        id: 'sharedAuthUserEditPage',
        title: `Edit shared auth for ${properties.rcExtensionId.description}`,
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

exports.getSharedAuthUserEditPageRender = getSharedAuthUserEditPageRender;
