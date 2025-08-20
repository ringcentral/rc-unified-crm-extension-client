import callIcon from '../images/outboundCallIcon.png';

function getCalldownPageRender() {
    const page = {
        id: 'calldownPage',
        title: 'Call-down',
        type: 'tab',
        priority: 106,
        iconUri: callIcon,
        activeIconUri: callIcon,
        darkIconUri: callIcon,
        schema: {
            type: 'object',
            properties: {
                filterName: { type: 'string', title: 'Filter by name' },
                filterStatus: { type: 'string', title: 'Status', enum: ['All', 'Called', 'Not Called'], default: 'All' },
                records: {
                    type: 'string',
                    title: 'Contacts',
                    oneOf: [] // backend-fed later
                }
            }
        },
        uiSchema: {
            filterName: { 'ui:placeholder': 'Search contacts by name', 'ui:label': false },
            records: { 'ui:field': 'list', 'ui:showIconAsAvatar': false }
        },
        formData: {
            filterName: '',
            filterStatus: 'all'
        }
    };
    return page;
}

exports.getCalldownPageRender = getCalldownPageRender;

