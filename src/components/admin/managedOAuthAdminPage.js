function getManagedOAuthAdminPageRender() {
    return {
        id: 'managedOAuthAdminPage',
        title: 'Managed OAuth',
        type: 'page',
        schema: {
            type: 'object',
            properties: {
                managedOAuthAccount: {
                    type: 'string',
                    oneOf: [
                        {
                            const: 'managedOAuthAccount',
                            title: 'Managed OAuth account',
                            description: 'Delete the stored managed OAuth credentials for this CRM account.',
                            actions: [
                                {
                                    id: 'deleteManagedOAuthAccount',
                                    type: 'button',
                                    title: 'Delete',
                                    variant: 'contained',
                                    color: 'danger.b03'
                                }
                            ]
                        }
                    ]
                }
            }
        },
        uiSchema: {
            submitButtonOptions: {
                norender: true,
            },
            managedOAuthAccount: {
                'ui:field': 'list',
                'ui:readonly': true,
                'ui:showSelected': false,
            }
        }
    };
}

exports.getManagedOAuthAdminPageRender = getManagedOAuthAdminPageRender;
