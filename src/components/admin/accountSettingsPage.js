// Admin-only, account-level settings defined in the platform manifest's `adminSettings` array
// (kept separate from `settings` so legacy clients never render them). Items with an
// `accountDataKey` get their options from the server's /accountData endpoint.
function getAccountSettingsPageRender({ platform, adminUserSettings, accountDataOptions }) {
    if (!platform?.adminSettings?.length) {
        return null;
    }
    const page = {
        id: 'accountSettingsPage',
        title: 'Account settings',
        type: 'page',
        schema: {
            type: 'object',
            required: [],
            properties: {}
        },
        uiSchema: {
            submitButtonOptions: {
                submitText: 'Save',
            },
        },
        formData: {}
    };
    for (const setting of platform.adminSettings) {
        switch (setting.type) {
            case 'warning':
                page.schema.properties[setting.id] = {
                    type: 'string',
                    description: setting.value
                };
                page.uiSchema[setting.id] = {
                    "ui:field": "admonition",
                    "ui:severity": "warning"
                };
                break;
            case 'inputField':
            case 'boolean':
                page.schema.properties[setting.id] = {
                    type: 'object',
                    title: setting.name,
                    properties: {
                        value: {
                            type: setting.type === 'inputField' ? 'string' : 'boolean',
                            title: setting.name
                        }
                    }
                };
                page.formData[setting.id] = {
                    value: adminUserSettings?.[setting.id]?.value ?? setting.defaultValue
                };
                break;
            case 'option': {
                const options = setting.accountDataKey ?
                    (accountDataOptions?.[setting.accountDataKey] ?? []) :
                    (setting.options ?? []).map(option => ({ const: option.id, title: option.name }));
                page.schema.properties[setting.id] = {
                    type: 'object',
                    title: setting.name,
                    properties: {
                        value: {
                            type: 'string',
                            title: setting.name,
                            oneOf: [
                                { const: '', title: 'Auto' },
                                ...options
                            ]
                        }
                    }
                };
                page.formData[setting.id] = {
                    value: adminUserSettings?.[setting.id]?.value ?? setting.defaultValue ?? ''
                };
                break;
            }
        }
    }
    return page;
}
exports.getAccountSettingsPageRender = getAccountSettingsPageRender;
