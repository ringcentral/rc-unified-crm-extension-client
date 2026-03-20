import { t } from '../i18n';

function getPluginConfigurePageRender({ pluginId, pluginAccess, plugin, config, isLoggedIn, hasValidLicense = false, licenseStatusDescription = '' }) {
    const customForm = plugin.pageContent;
    let customFormProperties = {};
    let customFormUiSchema = {};
    let customFormRequired = [];
    if (customForm) {
        for (const field of customForm) {
            const key = field.const;
            const schemaProp = {
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
    const page = {
        id: 'pluginConfigurePage',
        title: t('plugins.configurePage'),
        type: 'page',
        schema: {
            type: 'object',
            required: customFormRequired,
            properties: {
                basicInfo: {
                    type: 'string',
                    title: t('plugins.basicInfo'),
                    oneOf: [
                        {
                            const: 'basicInfo',
                            title: plugin.displayName ?? plugin.name,
                            icon: plugin.iconUrl ?? 'https://raw.githubusercontent.com/ringcentral/rc-unified-crm-extension-client/refs/heads/main/public/images/logo48.png',
                            description: `by ${plugin.name.split('.')[0]}`,
                        }
                    ]
                },
                description: {
                    type: 'string',
                    description: plugin.description,
                },
                ...customFormProperties
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
            },
            ...customFormUiSchema
        },
        formData: {
            isFromAdmin: false,
            config,
            access: pluginAccess,
            pluginId,
            plugin,
            isAsync: plugin.isAsync,
            phase: plugin.phase,
            logTypes: plugin.supportedLogTypes,
            isLoggedIn
        }
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

exports.getPluginConfigurePageRender = getPluginConfigurePageRender;

