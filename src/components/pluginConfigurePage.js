import { t } from '../i18n';

function getPluginConfigurePageRender({ pluginId, pluginAccess, plugin, config, isLoggedIn }) {
    const customForm = plugin.pageContent;
    let customFormProperties = {};
    let customFormUiSchema = {};
    let customFormRequired = [];
    if(customForm) {
        for (const field of customForm) {
            const key = field.const;
            const schemaProp = {
                type: field.type === 'selection' ? 'string' : field.type,
                title: field.title,
            };
            if (field.description) {
                schemaProp.description = field.description;
            }
            if (field.type === 'selection' && field.oneOf) {
                schemaProp.oneOf = field.oneOf;
            }
            customFormProperties[key] = schemaProp;

            if (field.required) {
                customFormRequired.push(key);
            }

            const uiEntry = { ...(field.uiSchema ?? {}) };
            if (field.type === 'selection') {
                uiEntry['ui:widget'] = 'select';
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
                ...customFormProperties,
                activated: {
                    type: 'boolean',
                    title: t('plugins.enablePlugin'),
                    default: config?.activated?.value ?? false,
                }
            }
        },
        uiSchema: {
            submitButtonOptions:{
                submitText: t('common.buttons.save'),
            },
            basicInfo: {
                "ui:field": "list",
                "ui:showIconAsAvatar": false,
                "ui:readonly": true,
                "ui:showSelected": false,
            },
            description: {
                "ui:field": "typography",
                "ui:variant": "body1",
            },
            ...customFormUiSchema,
            activated: {
                "ui:disabled": config?.activated?.isCustomizable ?? false
            }
        },
        formData: {
            isFromAdmin: false,
            config,
            access: pluginAccess,
            pluginId,
            plugin,
            isAsync: plugin.isAsync,
            phase: plugin.phase,
            logType: plugin.supportedLogType,
        }
    }
    if (plugin.showAuthorizationButton) {
        if (isLoggedIn) {
            page.schema.properties.logoutButton = {
                type: 'string',
                title: t('common.buttons.logout'),
            }
            page.uiSchema.logoutButton = {
                "ui:field": "button",
                "ui:variant": "contained",
                "ui:fullWidth": true,
                "ui:color": "danger.b03",
            }
        }
        else {
            page.schema.properties.authButton = {
                type: 'string',
                title: t('common.buttons.connect'),
            }
            page.uiSchema.authButton = {
                "ui:field": "button",
                "ui:variant": "contained",
                "ui:fullWidth": true
            }
        }
    }
    return page;
}

exports.getPluginConfigurePageRender = getPluginConfigurePageRender;

