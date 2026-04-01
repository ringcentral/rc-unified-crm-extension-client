function getSharedAuthOrgPageRender({ orgFields = [], orgValues = {}, formData = {} }) {
    const properties = {};
    const uiSchema = {
        submitButtonOptions: {
            submitText: 'Save'
        }
    };
    const nextFormData = {
        ...formData
    };

    orgFields.forEach(field => {
        const storedValue = orgValues[field.const] ?? {};
        const hasFormValue = Object.prototype.hasOwnProperty.call(formData, field.const);
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
        id: 'sharedAuthOrgPage',
        title: 'Organization shared authentication',
        type: 'page',
        schema: {
            type: 'object',
            properties
        },
        uiSchema,
        formData: nextFormData
    };
}

exports.getSharedAuthOrgPageRender = getSharedAuthOrgPageRender;
