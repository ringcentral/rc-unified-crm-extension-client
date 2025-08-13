function getUserMappingPageRender({ userMapping, rcExtensionList }) {
    const userMappingList = [];
    for (const um of userMapping) {
        let matchedRcUser = null;
        if (um.rcExtensionId && um.rcExtensionId !== 'none') {
            matchedRcUser = rcExtensionList.find(u => u.id === um.rcExtensionId);
            userMappingList.push({
                const: um.crmUserId,
                title: um.crmUserName,
                description: `${um.crmUserEmail}, ext: ${matchedRcUser.extensionNumber}`,
                meta: '(Click to edit)'
            })
            continue;
        }
        matchedRcUser = rcExtensionList.find(u =>
            u.email === um.crmUserEmail ||
            u.name === um.crmUserName ||
            (`${u.firstName} ${u.lastName}` === um.crmUserName)
        );
        if (matchedRcUser && um.rcExtensionId !== 'none') {
            userMappingList.push({
                const: um.crmUserId,
                title: um.crmUserName,
                description: `${um.crmUserEmail}, ext: ${matchedRcUser.extensionNumber}`,
                meta: '(Click to edit)'
            })
            um.rcExtensionId = matchedRcUser.id;
        }
        else {
            userMappingList.push({
                const: um.crmUserId,
                title: um.crmUserName,
                description: 'Unmatched',
                meta: '(Click to edit)'
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
        },
        formData: {
            allUserMapping: userMapping
        }
    }
}

exports.getUserMappingPageRender = getUserMappingPageRender;