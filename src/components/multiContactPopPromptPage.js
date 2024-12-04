function getMultiContactPopPromptPageRender({ contactInfo, searchWord }) {
    const filteredContactInfo = !!searchWord ? contactInfo.filter(c => c.name.toLowerCase().includes(searchWord.toLowerCase()) || c.id.toString().toLowerCase().includes(searchWord.toLowerCase())) : contactInfo;
    const filteredContactList = [];
    for (const c of filteredContactInfo) {
        filteredContactList.push({
            const: c.id,
            title: c.name,
            description: `${c.type} - ${c.id}`
        })
    }
    return {
        id: 'getMultiContactPopPromptPage',
        title: 'Click contact to open',
        type: 'page',
        schema: {
            type: 'object',
            properties: {
                search: {
                    type: "string",
                },
                contactList: {
                    type: 'string',
                    title: 'Contacts',
                    oneOf: filteredContactList
                }
            }
        },
        uiSchema: {
            search: {
                "ui:placeholder": 'Search',
                "ui:label": false,
            },
            contactList: {
                "ui:field": "list",
                // "ui:showIconAsAvatar": true, // optional, default true. show icon as avatar (round) in list
            }
        },
        formData: {
            search: searchWord ?? '',
            contactInfo
        }
    }
}

exports.getMultiContactPopPromptPageRender = getMultiContactPopPromptPageRender;