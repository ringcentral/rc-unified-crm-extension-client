function getSharedAuthUserPageRender({ userFields = [], userValues = [], rcExtensions = [], selectedRcExtensionId = '' }) {
    const selectedEntry = userValues.find(user => user.rcExtensionId === selectedRcExtensionId) ?? null;
    const properties = {
        rcExtensionId: {
            type: 'string',
            title: 'RingCentral user',
            oneOf: rcExtensions.map(extension => ({
                const: extension.id,
                title: extension.name || `${extension.firstName ?? ''} ${extension.lastName ?? ''}`.trim() || extension.id
            }))
        }
    };
    const uiSchema = {
        submitButtonOptions: {
            submitText: 'Save'
        }
    };
    const formData = {
        rcExtensionId: selectedRcExtensionId
    };

    userFields.forEach(field => {
        const storedValue = selectedEntry?.fields?.[field.const] ?? {};
        properties[field.const] = {
            title: field.title,
            type: field.type,
            description: storedValue.hasValue && field.confidential
                ? `${field.description ?? ''}${field.description ? ' ' : ''}Stored value is hidden. Enter a new value to replace it.`
                : field.description
        };
        if (field.uiSchema) {
            uiSchema[field.const] = field.uiSchema;
        }
        if (storedValue.hasValue && !field.confidential) {
            formData[field.const] = storedValue.value;
        }
    });

    return {
        id: 'sharedAuthUserPage',
        title: 'User shared authentication',
        type: 'page',
        schema: {
            type: 'object',
            required: ['rcExtensionId'],
            properties
        },
        uiSchema,
        formData
    };
}

exports.getSharedAuthUserPageRender = getSharedAuthUserPageRender;
