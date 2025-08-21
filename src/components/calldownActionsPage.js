function getCalldownActionsPageRender({ item, filterName = '', filterStatus = 'All' }) {
    const title = item?.contactName && item.contactName.trim() !== '' ? item.contactName : (item?.phoneNumber ?? 'Contact');
    return {
        id: 'calldownActionsPage',
        title: 'Actions',
        type: 'page',
        schema: {
            type: 'object',
            properties: {
                info: { type: 'string', description: title },
                calldownActionCall: { type: 'string', title: 'Call now' },
                calldownActionOpen: { type: 'string', title: 'Open contact' },
                calldownActionRemove: { type: 'string', title: 'Remove from list' }
            }
        },
        uiSchema: {
            info: { 'ui:field': 'typography', 'ui:variant': 'body1' },
            calldownActionCall: { 'ui:field': 'button', 'ui:variant': 'outlined' },
            calldownActionOpen: { 'ui:field': 'button', 'ui:variant': 'contained' },
            calldownActionRemove: { 'ui:field': 'button', 'ui:variant': 'contained', 'ui:color': 'danger.b03' }
        },
        formData: {
            recordId: item?.id ?? '',
            filterName,
            filterStatus,
        }
    };
}

exports.getCalldownActionsPageRender = getCalldownActionsPageRender;


