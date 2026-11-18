type UnknownRecord = Record<string, any>;

// RingCX agent IDs of the mapped RingCentral users, as returned by the server user mapping.
function getRcxAgentIdsLabel(rcUsers: UnknownRecord[]): string {
    const agentIds = Array.from(new Set(rcUsers.flatMap(rcUser => (
        Array.isArray(rcUser?.agentIds) ? rcUser.agentIds.map(String) : []
    ))));
    if (agentIds.length === 0) {
        return '';
    }
    return ` | RingCX agent ${agentIds.length > 1 ? 'IDs' : 'ID'}: ${agentIds.join(', ')}`;
}

function getUserMappingPageRender({ userMapping, platformDisplayName, searchWord = '', filter = 'All' }: UnknownRecord): UnknownRecord {
    let userMappingList: UnknownRecord[] = [];
    for (const um of userMapping) {
        if (um.rcUser?.length > 0) {
            const description = `${um.rcUser[0].name} - ext: ${um.rcUser[0].extensionNumber}` + (um.rcUser.length > 1 ? ` (+${um.rcUser.length - 1} others)` : '') + getRcxAgentIdsLabel(um.rcUser);
            userMappingList.push({
                const: um.crmUser.id,
                title: um.crmUser.name,
                description,
                meta: 'Mapped',
                actions: [
                    {
                        id: 'usermappingEdit',
                        title: 'Edit',
                        icon: 'edit'
                    },
                    {
                        id: 'usermappingRemove',
                        title: 'Remove',
                        icon: 'delete'
                    }
                ]
            })
        }
        else {
            userMappingList.push({
                const: um.crmUser.id,
                title: um.crmUser.name,
                description: '(Unknown)',
                meta: 'Unmapped',
                actions: [
                    {
                        id: 'usermappingEdit',
                        title: 'Edit',
                        icon: 'edit'
                    }
                ]
            })
        }
    }
    if (searchWord) {
        userMappingList = userMappingList.filter(um => um.title.toLowerCase().includes(searchWord.toLowerCase()) || um.description.toLowerCase().includes(searchWord.toLowerCase()));
    }
    if (filter !== 'All') {
        userMappingList = userMappingList.filter(um => um.meta === filter);
    }
    return {
        id: 'userMappingPage',
        title: 'User mapping',
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
                userMappingTitle: {
                    type: 'string',
                    description: `${platformDisplayName} Users`
                },
                userMappingList: {
                    type: 'string',
                    title: 'User mapping',
                    oneOf: userMappingList
                }
            }
        },
        uiSchema: {
            userSearch: {
                "ui:field": "search",
                "ui:placeholder": "Search with filters...",
                "ui:filters": [
                    "All",
                    "Unmapped",
                    "Mapped"
                ]
            },
            userMappingList: {
                "ui:field": "list"
            },
            userMappingTitle: {
                "ui:field": "typography",
                "ui:variant": "body2",
            }
        },
        formData: {
            allUserMapping: userMapping,
            userSearch: {
                search: searchWord,
                filter: filter
            }
        }
    }
}

export { getUserMappingPageRender };
export default {
    getUserMappingPageRender,
};
