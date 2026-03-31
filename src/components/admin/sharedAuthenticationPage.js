function getSharedAuthenticationPageRender({ hasOrgFields, hasUserFields }) {
    const sections = [];
    if (hasOrgFields) {
        sections.push({
            const: 'sharedAuthOrg',
            title: 'Organization shared auth'
        });
    }
    if (hasUserFields) {
        sections.push({
            const: 'sharedAuthUser',
            title: 'User shared auth'
        });
    }

    return {
        id: 'sharedAuthenticationPage',
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

exports.getSharedAuthenticationPageRender = getSharedAuthenticationPageRender;
