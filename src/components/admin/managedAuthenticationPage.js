function getManagedAuthenticationPageRender({ hasOrgFields, hasUserFields }) {
    const sections = [];
    if (hasOrgFields) {
        sections.push({
            const: 'managedAuthOrg',
            title: 'Organization managed auth'
        });
    }
    if (hasUserFields) {
        sections.push({
            const: 'managedAuthUser',
            title: 'User managed auth'
        });
    }

    return {
        id: 'managedAuthenticationPage',
        title: 'Shared authentication',
        type: 'page',
        schema: {
            type: 'object',
            properties: {
                section: {
                    type: 'string',
                    oneOf: sections
                }
            }
        },
        uiSchema: {
            section: {
                'ui:field': 'list',
                'ui:navigation': true,
            }
        }
    };
}

exports.getManagedAuthenticationPageRender = getManagedAuthenticationPageRender;
