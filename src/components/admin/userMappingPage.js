function getUserMappingPageRender({ userMapping, rcExtensionList }) {
    const userMappingList = [];
    for (const um of userMapping) {
        if (um.rcExtensionId) {
            userMappingList.push({
                const: um.crmUserId,
                title: um.mappingParams?.crmUserFirstName + ' ' + um.mappingParams?.crmUserLastName,
                description: um.mappingParams?.crmUserEmail,
                meta: 'Admin set'
            })
            continue;
        }
        const matchedRcUser = rcExtensionList.filter(u => u.status === 'Enabled').find(u =>
            u.email === um.mappingParams?.crmUserEmail ||
            u.name === `${um.mappingParams?.crmUserFirstName} ${um.mappingParams?.crmUserLastName}` ||
            (u.firstName === um.mappingParams?.crmUserFirstName && u.lastName === um.mappingParams?.crmUserLastName)
        );
        if (matchedRcUser) {
            userMappingList.push({
                const: um.crmUserId,
                title: um.mappingParams?.crmUserFirstName + ' ' + um.mappingParams?.crmUserLastName,
                description: um.mappingParams?.crmUserEmail,
                meta: 'Auto mapped'
            })
        }
        else {
            userMappingList.push({
                const: um.crmUserId,
                title: um.mappingParams?.crmUserFirstName + ' ' + um.mappingParams?.crmUserLastName,
                description: um.mappingParams?.crmUserEmail,
                meta: 'Unset'
            })
        }
    }
    return {
        id: 'userMappingPage',
        title: 'User mapping',
        type: 'page',
        schema: {
            type: 'object',
            properties: {
                userMappingList: {
                    type: 'string',
                    title: 'User mapping',
                    oneOf: userMappingList
                }
            }
        },
        uiSchema: {
            userMappingList: {
                "ui:field": "list",
            }
        }
    }
}

exports.getUserMappingPageRender = getUserMappingPageRender;