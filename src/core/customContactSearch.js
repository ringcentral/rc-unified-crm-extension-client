import axios from 'axios';
import { showNotification } from '../lib/util';
function getCustomContactSearch() {
    return {
        id: 'searchContact',
        type: 'page',
        schema: {
            type: 'object',
            required: [],
            properties: {
                contactNameToSearch: {
                    type: 'string',
                    title: 'Contact Search'
                },
                contactSearchAdapterButton: {
                    type: 'string',
                    title: 'Search'
                }
            }
        },
        uiSchema: {
            customAdapter: {
                'ui:field': 'typography'
            },
            contactNameToSearch: {
                "ui:placeholder": 'enter contact name to search',
            },
            contactSearchAdapterButton: {
                "ui:field": "button",
                "ui:variant": "contained", // "text", "outlined", "contained", "plain"
                "ui:fullWidth": true
            }
        },
        formData: {
        }
    }
}
async function getCustomContactSearchData({ serverUrl, platform, contactSearch }) {
    const { rcUnifiedCrmExtJwt } = await chrome.storage.local.get('rcUnifiedCrmExtJwt');
    const contactRes = await axios.get(`${serverUrl}/custom/contact/search?jwtToken=${rcUnifiedCrmExtJwt}&name=${contactSearch}`);
    if (contactRes.data.contact.length === 0) {
        showNotification({
            level: contactRes.data.returnMessage.messageType, message: contactRes.data.returnMessage.message, ttl: contactRes.data.returnMessage.ttl
        });
    } else {
        const contactInfo = contactRes.data.contact;
        const filteredContactList = [];
        for (const c of contactInfo) {
            filteredContactList.push({
                const: c.id,
                title: c.name,
                description: `${c.type} - ${c.id}`
            })
        }
        return {
            id: 'searchContactResult',
            title: 'Select Contact to Add',
            type: 'page',
            schema: {
                type: 'object',
                properties: {
                    contactList: {
                        type: 'string',
                        title: 'Contacts',
                        oneOf: filteredContactList
                    }
                }
            },
            uiSchema: {
                contactList: {
                    "ui:field": "list",
                    // "ui:showIconAsAvatar": true, // optional, default true. show icon as avatar (round) in list
                }
            },
            formData: {
                search: contactSearch ?? '',
                contactInfo
            }
        }
    }
}
exports.getCustomContactSearch = getCustomContactSearch;
exports.getCustomContactSearchData = getCustomContactSearchData;