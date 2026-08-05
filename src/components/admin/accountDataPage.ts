type UnknownRecord = Record<string, any>;

// Admin-only page to force refresh all account-level CRM data (the server caches it
// with a lazy TTL; this button is the manual escape hatch when CRM config just changed).
function getAccountDataPageRender({ platform }: UnknownRecord): UnknownRecord {
    const dataKeys = [...new Set((platform?.adminSettings ?? [])
        .filter((setting: UnknownRecord) => setting.accountDataKey)
        .map((setting: UnknownRecord) => setting.accountDataKey))];
    const page = {
        id: 'accountDataPage',
        title: 'Account data',
        type: 'page',
        schema: {
            type: 'object',
            required: [],
            properties: {
                info: {
                    type: 'string',
                    description: `App Connect caches account-level data from your CRM (${dataKeys.join(', ')}) and refreshes it automatically once a day. If you just changed this data in your CRM, refresh it here to apply the change immediately.`
                }
            }
        },
        uiSchema: {
            info: {
                "ui:field": "admonition",
                "ui:severity": "info"
            },
            submitButtonOptions: {
                submitText: 'Refresh all account data',
            },
        },
        formData: {}
    };
    return page;
}

export { getAccountDataPageRender };
export default {
    getAccountDataPageRender,
};
