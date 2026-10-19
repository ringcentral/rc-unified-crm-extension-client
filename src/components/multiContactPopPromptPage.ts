import { t } from '../i18n';

type UnknownRecord = Record<string, any>;

function getMultiContactPopPromptPageRender({ contactInfo, searchWord }: UnknownRecord): UnknownRecord {
    const filteredContactInfo = searchWord ? contactInfo.filter(c => c.name.toLowerCase().includes(searchWord.toLowerCase()) || c.id.toString().toLowerCase().includes(searchWord.toLowerCase())) : contactInfo;
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
        title: t('pages.multiContactPrompt.title'),
        type: 'page',
        schema: {
            type: 'object',
            properties: {
                search: {
                    type: "string",
                },
                contactList: {
                    type: 'string',
                    title: t('pages.multiContactPrompt.contacts'),
                    oneOf: filteredContactList
                }
            }
        },
        uiSchema: {
            search: {
                "ui:placeholder": t('common.labels.search'),
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

export { getMultiContactPopPromptPageRender };
export default {
    getMultiContactPopPromptPageRender,
};
