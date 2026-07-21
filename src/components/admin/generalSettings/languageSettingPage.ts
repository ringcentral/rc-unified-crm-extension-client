import i18n, { t } from '../../../i18n';

type UnknownRecord = Record<string, any>;

function getLanguageValueOptions(): UnknownRecord[] {
    return [
        { const: 'auto', title: t('settings.appearance.languageAuto') },
        ...i18n.getSupportedLocaleOptions().map(option => ({
            const: option.id,
            title: option.name,
        })),
    ];
}

function getLanguageSettingPageRender({ adminUserSettings }: UnknownRecord): UnknownRecord {
    return {
        id: 'languageSettingPage',
        title: t('settings.appearance.language'),
        type: 'page',
        schema: {
            type: 'object',
            required: [],
            properties: {
                language: {
                    type: 'object',
                    title: t('settings.appearance.language'),
                    properties: {
                        customizable: {
                            type: 'boolean',
                            title: t('common.labels.customizableByUser')
                        },
                        value: {
                            type: 'string',
                            title: t('common.labels.value'),
                            oneOf: getLanguageValueOptions()
                        }
                    }
                }
            }
        },
        uiSchema: {
            language: {
                "ui:collapsible": true,
            },
            submitButtonOptions: {
                submitText: t('common.buttons.save'),
            }
        },
        formData: {
            language: {
                customizable: adminUserSettings?.language?.customizable ?? true,
                value: adminUserSettings?.language?.value ?? 'auto'
            }
        }
    }
}

export { getLanguageSettingPageRender };
export default {
    getLanguageSettingPageRender,
};
