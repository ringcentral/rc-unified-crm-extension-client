import callIcon from '../images/outboundCallIcon.png';
import axios from 'axios';
import userCore from '../core/user';

function getCalldownPageRender() {
    const page = {
        id: 'calldownPage',
        title: 'Call-down',
        type: 'tab',
        priority: 67,
        iconUri: callIcon,
        activeIconUri: callIcon,
        darkIconUri: callIcon,
        schema: {
            type: 'object',
            properties: {
                "searchWithFilters": {
                    "type": "object",
                    "properties": {
                        "search": {
                            "type": "string",
                            "title": "Search"
                        },
                        "filter": {
                            "type": "string",
                            "title": "Filter"
                        }
                    }
                },
                records: {
                    type: 'string',
                    title: 'Contacts',
                    oneOf: [] // backend-fed later
                }
            }
        },
        uiSchema: {
            "searchWithFilters": {
                "ui:field": "search",
                "ui:placeholder": "Filter by name",
                "ui:filters": [
                    "All",
                    "Not Called",
                    "Called",
                    "Scheduled"
                ]
            },
            records: { 'ui:field': 'list', 'ui:showIconAsAvatar': false }
        },
        formData: {
            searchWithFilters: {
                search: '',
                filter: 'All'
            }
        }
    };
    return page;
}

exports.getCalldownPageRender = getCalldownPageRender;

async function getCalldownPageWithRecords({ manifest, jwtToken, filterName = '', filterStatus = 'All', searchWithFilters = {}, userSettings }) {
    const page = getCalldownPageRender();
    const isHidden = !userCore.getShowCalldownTabSetting(userSettings).value;
    page.hidden = isHidden;
    // Support new UI first, fallback to legacy
    const resolvedSearch = (searchWithFilters.search ?? filterName ?? '').trim();
    const resolvedStatus = (searchWithFilters.filter ?? filterStatus ?? 'All');
    page.formData.searchWithFilters = {
        search: searchWithFilters.search ?? '',
        filter: resolvedStatus
    };

    try {
        const { data } = await axios.get(`${manifest.serverUrl}/calldown`, {
            params: {
                jwtToken,
                status: resolvedStatus
            }
        });
        const nowTs = Date.now();
        let items = Array.isArray(data?.items) ? data.items : [];
        // Compute derived status per item and then apply filter locally
        const itemsWithDerived = items.map(i => {
            const rawStatus = String(i.status || '').toLowerCase();
            let derivedStatus = 'Not Called';
            if (rawStatus === 'called') {
                derivedStatus = 'Called';
            }
            else if (rawStatus === 'scheduled') {
                const sd = i.scheduledAt ? new Date(i.scheduledAt) : null;
                derivedStatus = sd && sd.getTime() < nowTs ? 'Not Called' : 'Scheduled';
            }
            return { ...i, _derivedStatus: derivedStatus };
        });
        if (resolvedStatus && resolvedStatus !== 'All') {
            items = itemsWithDerived.filter(i => i._derivedStatus === resolvedStatus);
        }
        else {
            items = itemsWithDerived;
        }

        // Build contactId -> { name, phone } index from RC widget matcher
        const idToContact = new Map();
        try {
            const platformInfo = await chrome.storage.local.get('platform-info');
            const platformName = platformInfo['platform-info']?.platformName ?? '';
            const matcherRoot = document.querySelector('#rc-widget-adapter-frame')?.contentWindow?.phone?.contactMatcher?.data ?? {};
            for (const [phone, platformData] of Object.entries(matcherRoot)) {
                const arr = platformData?.[platformName]?.data ?? [];
                for (const c of arr) {
                    if (c && !c.isNewContact && c.id) {
                        if (!idToContact.has(String(c.id))) idToContact.set(String(c.id), { name: c.name, phone });
                    }
                }
            }
        } catch (e) {
            // ignore if matcher not present
        }

        // Load cached contact information for calldown items
        const { calldownContactCache = {} } = await chrome.storage.local.get('calldownContactCache');

        // Enrich FIRST so we can filter using resolved names/phones (RC matcher + cache)
        const enriched = items.map(i => {
            // First priority: RC widget matcher (for contacts that have been called/are in call history)
            const widgetMatched = idToContact.get(String(i.contactId));
            
            // Second priority: cached contact information (for scheduled but not called contacts)
            const cached = calldownContactCache[String(i.contactId)] || {};
            
            return {
                ...i,
                contactName: widgetMatched?.name ?? cached.contactName ?? i.contactName,
                phoneNumber: widgetMatched?.phone ?? cached.phoneNumber ?? i.phoneNumber,
                // Also store contact type from cache if available
                contactType: cached.contactType ?? i.contactType
            };
        });

        // client-side name filter using enriched values
        const normalizedSearch = resolvedSearch.toLowerCase();
        const filtered = normalizedSearch === ''
            ? enriched
            : enriched.filter(i => (
                (i.contactName || '').toLowerCase().includes(normalizedSearch) ||
                (i.phoneNumber || '').toLowerCase().includes(normalizedSearch)
            ));

        const today = new Date();
        const todayDateString = today.toDateString();

        page.schema.properties.records.oneOf = filtered.map(i => {
            const displayName = (i.contactName && i.contactName.trim() !== '') ? i.contactName : (i.phoneNumber ?? i.contactId);
            const dateSource = i.lastCallAt || i.scheduledAt;
            const d = dateSource ? new Date(dateSource) : null;
            const whenText = d
                ? (d.toDateString() === todayDateString
                    ? `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
                    : d.toLocaleDateString())
                : '';
            // Normalize status and color (use derived status)
            const statusText = i._derivedStatus || (i.status ? String(i.status) : '');
            // Keep status and time separate; show only time in meta for now
            const meta = whenText;
            const isCalled = (statusText || '').toLowerCase() === 'called';
            const completeIcon = isCalled ? 'read' : 'unread';
            const actions = [
                { id: 'calldownActionCall', title: 'Call', icon: 'phone' },
                { id: 'calldownActionText', title: 'Text', icon: 'sms' },
                { id: 'calldownActionOpen', title: 'View contact', icon: 'view' }
            ];
            if (!isCalled) {
                actions.push({ id: 'calldownActionEdit', title: 'Edit', icon: 'edit' });
            }
            actions.push(
                { id: 'calldownActionComplete', title: 'Mark as complete', icon: completeIcon },
                { id: 'calldownActionRemove', title: 'Delete', icon: 'delete', color: 'danger.b03' }
            );
            return {
                const: i.id,
                title: displayName,
                description: i.phoneNumber ?? '',
                authorName: statusText,
                meta,
                actions,
                additionalInfo: {
                    recordId: i.id,
                    contactId: i.contactId,
                    contactType: i.contactType,
                    phoneNumber: i.phoneNumber,
                    contactName: i.contactName,
                    statusText,
                    whenText,
                    scheduledAt: i.scheduledAt
                }
            };
        });
        // pill: number of calls scheduled today that haven't been called yet
        const todaysCount = items.filter(i => {
            if (!i.scheduledAt) return false;
            const d = new Date(i.scheduledAt);
            const isScheduledToday = d.toDateString() === todayDateString;
            
            // If scheduled today, check if it hasn't been called yet
            if (isScheduledToday) {
                // If no lastCallAt, it hasn't been called
                if (!i.lastCallAt) return true;
                
                // If lastCallAt exists, check if it's from today
                const lastCallDate = new Date(i.lastCallAt);
                const isCalledToday = lastCallDate.toDateString() === todayDateString;
                
                // Only count if not called today (so still needs to be called)
                return !isCalledToday;
            }
            
            return false;
        }).length;
        page.unreadCount = todaysCount;
        // cache current list
        await chrome.storage.local.set({ calldownListCache: filtered });
        
        // Clean up contact cache - keep only contacts that are still in the active items 
        // AND are not available in RC widget matcher
        try {
            const activeContactIds = items.map(i => String(i.contactId)).filter(id => id && id !== 'undefined');
            if (activeContactIds.length > 0) {
                const updatedCache = {};
                
                // Keep only contacts that are still in the active list AND not in RC matcher
                for (const contactId of activeContactIds) {
                    if (calldownContactCache[contactId]) {
                        // Check if this contact is now available in RC widget matcher
                        const widgetMatched = idToContact.get(String(contactId));
                        if (!widgetMatched) {
                            // Contact is not in RC matcher, keep it in cache
                            updatedCache[contactId] = calldownContactCache[contactId];
                        }
                    }
                }
                
                // Only update if there's a change to avoid unnecessary storage writes
                if (Object.keys(updatedCache).length !== Object.keys(calldownContactCache).length) {
                    await chrome.storage.local.set({ calldownContactCache: updatedCache });
                }
            }
        } catch (error) {
            console.warn('Failed to cleanup calldown contact cache:', error);
        }
    }
    catch (e) {
        // leave list empty on error
    }

    return page;
}

exports.getCalldownPageWithRecords = getCalldownPageWithRecords;

