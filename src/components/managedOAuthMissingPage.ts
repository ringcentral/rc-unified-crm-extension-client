type UnknownRecord = Record<string, any>;

function getManagedOAuthMissingPageRender(): UnknownRecord {
    return {
        id: 'managedOAuthMissingPage',
        title: 'Authorization information is not provided',
        schema: {
            type: 'object',
            properties: {
                message: {
                    type: 'string',
                    description: 'Authorization information is not provided. Please contact the admin user.',
                }
            }
        },
        uiSchema: {
            submitButtonOptions: {
                norender: true,
            },
            message: {
                'ui:field': 'admonition',
                'ui:severity': 'warning',
            }
        },
        formData: {}
    };
}

export { getManagedOAuthMissingPageRender };
export default {
    getManagedOAuthMissingPageRender,
};
