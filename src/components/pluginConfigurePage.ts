import { t } from '../i18n';

type UnknownRecord = Record<string, any>;

const DEFAULT_PLUGIN_ICON_URL = 'https://raw.githubusercontent.com/ringcentral/rc-unified-crm-extension-client/refs/heads/main/public/images/logo48.png';

function getPluginIconUrl(plugin: UnknownRecord): string {
    return plugin.iconUrl ?? plugin.logoUrl ?? DEFAULT_PLUGIN_ICON_URL;
}

function getMergedPluginConfigFromFormData(formData: UnknownRecord = {}): UnknownRecord {
    const config: UnknownRecord = {
        ...(formData.existingConfig ?? {})
    };
    for (const key in (formData.config ?? {})) {
        const submittedValue = formData.config[key];
        config[key] = {
            ...(config[key] ?? {}),
            value: submittedValue
        };
    }
    return config;
}

function getMissingRequiredPluginConfigFields(plugin: UnknownRecord = {}, config: UnknownRecord = {}): UnknownRecord[] {
    return (plugin.pageContent ?? []).filter((field: UnknownRecord) => {
        if (field.hidden === true || !field.required) {
            return false;
        }
        const configEntry = config[field.const];
        const value = configEntry && typeof configEntry === 'object' && 'value' in configEntry
            ? configEntry.value
            : configEntry;
        return value === undefined || value === null || value === '';
    });
}

function getPluginConfigurePageRender({ pluginId, pluginAccess, plugin, config, isLoggedIn, hasValidLicense = false, licenseStatusDescription = '' }: UnknownRecord): UnknownRecord {
    const customForm = plugin.pageContent;
    const visibleCustomForm = customForm?.filter(field => field.hidden !== true);
    let customFormProperties: UnknownRecord = {};
    let customFormUiSchema: UnknownRecord = {};
    let customFormRequired: string[] = [];
    if (visibleCustomForm) {
        for (const field of visibleCustomForm) {
            const key = field.const;
            const schemaProp: UnknownRecord = {
                type: field.type === 'selection' ? 'string' : field.type,
                title: field.title,
                default: config[key]?.value ?? '',
                readOnly: config[key]?.customizable === undefined ? false : !config[key]?.customizable,
            };
            if (field.description) {
                schemaProp.description = field.description;
            }
            if (field.type === 'selection' && field.oneOf) {
                if (field.multiSelect) {
                    schemaProp.type = 'array';
                    schemaProp.items = {
                        type: 'string',
                        enum: field.oneOf.map(option => option.const),
                        enumNames: field.oneOf.map(option => option.title)
                    };
                    schemaProp.uniqueItems = true;
                }
                else {
                    schemaProp.oneOf = field.oneOf;
                }
            }
            customFormProperties[key] = schemaProp;

            if (field.required) {
                customFormRequired.push(key);
            }

            const uiEntry = { ...(field.uiSchema ?? {}) };
            if (field.type === 'selection') {
                if (field.multiSelect) {
                    uiEntry['ui:widget'] = 'checkboxes';
                } else {
                    uiEntry['ui:widget'] = 'select';
                }
            }
            customFormUiSchema[key] = uiEntry;
        }
    }
    const page: UnknownRecord = {
        id: 'pluginConfigurePage',
        title: t('plugins.configurePage'),
        type: 'page',
        schema: {
            type: 'object',
            // Embeddable checks root-level required values against root-level formData.
            // Plugin values live under formData.config, so keeping their keys here makes
            // the Save button permanently disabled. Nested validation belongs on config.
            required: [],
            properties: {
                basicInfo: {
                    type: 'string',
                    title: t('plugins.basicInfo'),
                    oneOf: [
                        {
                            const: 'basicInfo',
                            title: plugin.displayName ?? plugin.name,
                            icon: getPluginIconUrl(plugin),
                            description: `by ${plugin.name.split('.')[0]}`,
                        }
                    ]
                },
                description: {
                    type: 'string',
                    description: plugin.description,
                }
            }
        },
        uiSchema: {
            submitButtonOptions: {
                submitText: t('common.buttons.save'),
            },
            basicInfo: {
                "ui:field": "list",
                "ui:showIconAsAvatar": false,
                "ui:readonly": true,
                "ui:showSelected": false,
                'ui:alwaysShowActions': true,
            },
            description: {
                "ui:field": "typography",
                "ui:variant": "body1",
            }
        },
        formData: {
            isFromAdmin: false,
            access: pluginAccess,
            pluginId,
            plugin,
            isAsync: plugin.isAsync,
            phase: plugin.phase,
            logTypes: plugin.supportedLogTypes,
            isLoggedIn,
            existingConfig: config
        }
    }
    if (visibleCustomForm?.length > 0) {
        page.schema.properties.config = {
            type: 'object',
            title: 'Configuration',
            required: customFormRequired,
            properties: customFormProperties
        }
        page.uiSchema.config = customFormUiSchema;
    }
    if (plugin.showAuthorizationButton) {
        if (isLoggedIn) {
            page.schema.properties.basicInfo.oneOf[0].actions = [{
                id: 'pluginLogoutButton',
                type: 'button',
                variant: 'contained',
                color: 'danger.b03',
                title: t('common.buttons.logout'),
            }]
        }
        else {
            page.schema.properties.basicInfo.oneOf[0].actions = [{
                id: 'pluginAuthButton',
                type: 'button',
                title: t('common.buttons.connect'),
                variant: 'contained',
                color: 'primary'
            }]
        }
    }
    if (plugin.requireLicense) {
        page.schema.properties.basicInfo.oneOf.push({
            const: 'licenseStatus',
            title: t('common.labels.licenseStatus'),
            description: licenseStatusDescription,
            descriptionColor: hasValidLicense ? 'success' : 'error',
            actions: [
                {
                    id: 'pluginLicenseRefreshButton',
                    icon: 'refresh',
                    title: t('common.buttons.refresh')
                }
            ]
        });
    }
    return page;
}

export { getMergedPluginConfigFromFormData, getMissingRequiredPluginConfigFields, getPluginConfigurePageRender };
export default {
    getMergedPluginConfigFromFormData,
    getMissingRequiredPluginConfigFields,
    getPluginConfigurePageRender,
};
