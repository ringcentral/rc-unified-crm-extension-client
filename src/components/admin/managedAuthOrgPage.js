function getManagedAuthOrgPageRender({ orgFields = [], orgValues = {}, formData = {} }) {
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
            description: field.description
        };
        uiSchema[field.const] = field.uiSchema ?? {};
        if (!hasFormValue && storedValue.hasValue) {
            nextFormData[field.const] = storedValue.value;
        }
    });

    return {
        id: 'managedAuthOrgPage',
        title: 'Organization managed authentication',
        type: 'page',
        schema: {
            type: 'object',
            properties
        },
        uiSchema,
        formData: nextFormData
    };
}

exports.getManagedAuthOrgPageRender = getManagedAuthOrgPageRender;
