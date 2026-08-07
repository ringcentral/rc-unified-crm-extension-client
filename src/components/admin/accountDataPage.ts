import { getPlatformAccountDataKeys } from '../../lib/accountData';

type UnknownRecord = Record<string, any>;

// Admin-only manual refresh page for account-level CRM data. Data can be consumed
// by admin settings or directly by contact/log fields, independently of admin defaults.
function getAccountDataPageRender({ platform }: UnknownRecord): UnknownRecord {
    const dataKeys = getPlatformAccountDataKeys(platform);
    return {
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
}

export { getAccountDataPageRender };
export default {
    getAccountDataPageRender,
};
