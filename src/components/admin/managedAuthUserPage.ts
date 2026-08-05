type UnknownRecord = Record<string, any>;

function getManagedAuthUserSummary({ userFields = [], userEntry = null }: UnknownRecord): UnknownRecord {
    const configuredFields = userFields.filter((field: UnknownRecord) => userEntry?.fields?.[field.const]?.hasValue);
    if (configuredFields.length === 0) {
        return {
            description: 'No managed auth fields configured',
            meta: 'Not configured'
        };
    }
    const configuredTitles = configuredFields.map((field: UnknownRecord) => field.title || field.const);
    return {
        description: configuredTitles.join(', '),
        meta: 'Configured'
    };
}

function getManagedAuthUserPageRender({
    userFields = [],
    userValues = [],
    rcExtensions = [],
    searchWord = '',
    filter = 'All'
}: UnknownRecord): UnknownRecord {
    let managedAuthUserList = rcExtensions.map((extension: UnknownRecord) => {
        const extensionName = extension.name || `${extension.firstName ?? ''} ${extension.lastName ?? ''}`.trim() || extension.id;
        const userEntry = userValues.find((user: UnknownRecord) => user.rcExtensionId === extension.id) ?? null;
        const summary = getManagedAuthUserSummary({ userFields, userEntry });
        return {
            const: extension.id,
            title: extensionName,
            description: summary.description,
            meta: summary.meta,
            actions: [
                {
                    id: 'managedAuthUserEdit',
                    title: 'Edit',
                    icon: 'edit'
                }
            ]
        };
    });

    if (searchWord) {
        const loweredSearchWord = searchWord.toLowerCase();
        managedAuthUserList = managedAuthUserList.filter((item: UnknownRecord) => (
            item.title.toLowerCase().includes(loweredSearchWord) ||
            item.description.toLowerCase().includes(loweredSearchWord)
        ));
    }
    if (filter !== 'All') {
        managedAuthUserList = managedAuthUserList.filter((item: UnknownRecord) => item.meta === filter);
    }

    return {
        id: 'managedAuthUserPage',
        title: 'User managed authentication',
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
                managedAuthUserTitle: {
                    type: 'string',
                    description: 'RingCentral users'
                },
                managedAuthUserList: {
                    type: 'string',
                    title: 'User managed authentication',
                    oneOf: managedAuthUserList
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
            managedAuthUserList: {
                'ui:field': 'list'
            },
            managedAuthUserTitle: {
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

export { getManagedAuthUserPageRender };
export default {
    getManagedAuthUserPageRender,
};
