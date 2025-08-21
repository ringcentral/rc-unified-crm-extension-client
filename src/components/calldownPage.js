import callIcon from '../images/outboundCallIcon.png';
import axios from 'axios';

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
            filterStatus: 'All'
        }
    };
    return page;
}

exports.getCalldownPageRender = getCalldownPageRender;

async function getCalldownPageWithRecords({ manifest, jwtToken, filterName = '', filterStatus = 'All' }) {
    const page = getCalldownPageRender();
    page.formData.filterName = filterName;
    page.formData.filterStatus = filterStatus;

    try {
        const { data } = await axios.get(`${manifest.serverUrl}/calldown/list`, {
            params: {
                jwtToken,
                status: filterStatus
            }
        });
        const items = Array.isArray(data?.items) ? data.items : [];

        // client-side name filter
        const normalizedSearch = (filterName || '').trim().toLowerCase();
        const filtered = normalizedSearch === ''
            ? items
            : items.filter(i => (i.contactName || i.phoneNumber || '').toLowerCase().includes(normalizedSearch));

        const today = new Date();
        const todayDateString = today.toDateString();

        page.schema.properties.records.oneOf = filtered.map(i => {
            const displayName = (i.contactName && i.contactName.trim() !== '') ? i.contactName : i.phoneNumber;
            const dateSource = i.lastCallAt || i.scheduledAt;
            const d = dateSource ? new Date(dateSource) : null;
            const meta = d
                ? (d.toDateString() === todayDateString
                    ? `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
                    : d.toLocaleDateString())
                : '';
            return {
                const: i.id,
                title: displayName,
                description: i.phoneNumber,
                meta,
                additionalInfo: {
                    contactId: i.contactId,
                    contactType: i.contactType
                }
            };
        });
        // pill: number of calls scheduled today
        const todaysCount = items.filter(i => {
            if (!i.scheduledAt) return false;
            const d = new Date(i.scheduledAt);
            return d.toDateString() === todayDateString;
        }).length;
        page.unreadCount = todaysCount;
        // cache current list for row click handling (id -> phoneNumber lookup)
        await chrome.storage.local.set({ calldownListCache: filtered });
    }
    catch (e) {
        // leave list empty on error
    }

    return page;
}

exports.getCalldownPageWithRecords = getCalldownPageWithRecords;

