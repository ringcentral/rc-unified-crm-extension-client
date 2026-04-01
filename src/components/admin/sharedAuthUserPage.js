function getSharedAuthUserSummary({ userFields = [], userEntry = null }) {
    const configuredFields = userFields.filter((field) => userEntry?.fields?.[field.const]?.hasValue);
    if (configuredFields.length === 0) {
        return {
            description: 'No shared auth fields configured',
            meta: 'Not configured'
        };
    }
    const configuredTitles = configuredFields.map((field) => field.title || field.const);
    return {
        description: configuredTitles.join(', '),
        meta: 'Configured'
    };
}

function getSharedAuthUserPageRender({
    userFields = [],
    userValues = [],
    rcExtensions = [],
    searchWord = '',
    filter = 'All'
}) {
    let sharedAuthUserList = rcExtensions.map((extension) => {
        const extensionName = extension.name || `${extension.firstName ?? ''} ${extension.lastName ?? ''}`.trim() || extension.id;
        const userEntry = userValues.find((user) => user.rcExtensionId === extension.id) ?? null;
        const summary = getSharedAuthUserSummary({ userFields, userEntry });
        return {
            const: extension.id,
            title: extensionName,
            description: summary.description,
            meta: summary.meta,
            actions: [
                {
                    id: 'sharedAuthUserEdit',
                    title: 'Edit',
                    icon: 'edit'
                }
            ]
        };
    });

    if (searchWord) {
        const loweredSearchWord = searchWord.toLowerCase();
        sharedAuthUserList = sharedAuthUserList.filter((item) => (
            item.title.toLowerCase().includes(loweredSearchWord) ||
            item.description.toLowerCase().includes(loweredSearchWord)
        ));
    }
    if (filter !== 'All') {
        sharedAuthUserList = sharedAuthUserList.filter((item) => item.meta === filter);
    }

    return {
        id: 'sharedAuthUserPage',
        title: 'User shared authentication',
        type: 'page',
        schema: {
            type: 'object',
            properties: {
                userSearch: {
                    type: 'object',
                    properties: {
                        search: {
                            type: 'string',
                            title: 'Search'
                        },
                        filter: {
                            type: 'string',
                            title: 'Filter'
                        }
                    }
                },
                sharedAuthUserTitle: {
                    type: 'string',
                    description: 'RingCentral users'
                },
                sharedAuthUserList: {
                    type: 'string',
                    title: 'User shared authentication',
                    oneOf: sharedAuthUserList
                }
            }
        },
        uiSchema: {
            userSearch: {
                'ui:field': 'search',
                'ui:placeholder': 'Search with filters...',
                'ui:filters': [
                    'All',
                    'Configured',
                    'Not configured'
                ]
            },
            sharedAuthUserList: {
                'ui:field': 'list'
            },
            sharedAuthUserTitle: {
                'ui:field': 'typography',
                'ui:variant': 'body2',
            }
        },
        formData: {
            allRcExtensions: rcExtensions,
            allUserValues: userValues,
            userSearch: {
                search: searchWord,
                filter
            }
        }
    };
}

exports.getSharedAuthUserPageRender = getSharedAuthUserPageRender;
