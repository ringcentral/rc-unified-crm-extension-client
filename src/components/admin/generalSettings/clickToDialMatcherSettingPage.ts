import { t } from '../../../i18n';

type UnknownRecord = Record<string, any>;

function getClickToDialMatcherSettingPageRender({ adminUserSettings }: UnknownRecord): UnknownRecord {
    return {
        id: 'clickToDialMatcherSettingPage',
        title: t('settings.clickToDialMatcher.name'),
        type: 'page',
        schema: {
            type: 'object',
            required: [],
            properties: {
                c2dMatcherType: {
                    type: 'object',
                    title: t('settings.clickToDialMatcher.name'),
                    description: t('settings.clickToDialMatcher.description'),
                    properties: {
                        customizable: {
                            type: 'boolean',
                            title: t('common.labels.customizableByUser')
                        },
                        value: {
                            type: 'string',
                            title: t('settings.clickToDialMatcher.matcherType'),
                            oneOf: [
                                {
                                    const: 'libPhone',
                                    title: t('settings.clickToDialMatcher.regionName'),
                                    description: t('settings.clickToDialMatcher.regionDesc')
                                },
                                {
                                    const: 'regExp',
                                    title: t('settings.clickToDialMatcher.allName'),
                                    description: t('settings.clickToDialMatcher.allDesc')
                                }
                            ],
                            default: 'libPhone'
                        }
                    }
                }
            }
        },
        uiSchema: {
            c2dMatcherType: {
                "ui:collapsible": true
            },
            submitButtonOptions: {
                submitText: t('common.buttons.save'),
            }
        },
        formData: {
            c2dMatcherType: {
                customizable: adminUserSettings?.c2dMatcherType?.customizable ?? true,
                value: adminUserSettings?.c2dMatcherType?.value ?? 'libPhone'
            }
        }
    }
}

export { getClickToDialMatcherSettingPageRender };
export default {
    getClickToDialMatcherSettingPageRender,
};
