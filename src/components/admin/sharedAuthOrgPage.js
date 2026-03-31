function getSharedAuthOrgPageRender({ orgFields = [], orgValues = {} }) {
    const properties = {};
    const uiSchema = {
        submitButtonOptions: {
            submitText: 'Save'
        }
    };
    const formData = {};

    orgFields.forEach(field => {
        const storedValue = orgValues[field.const] ?? {};
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
        id: 'sharedAuthOrgPage',
        title: 'Organization shared authentication',
        type: 'page',
        schema: {
            type: 'object',
            properties
        },
        uiSchema,
        formData
    };
}

exports.getSharedAuthOrgPageRender = getSharedAuthOrgPageRender;
