import i18n from '../../../i18n';

type UnknownRecord = Record<string, any>;

function getLanguageValueOptions(): UnknownRecord[] {
    return [
        { const: 'auto', title: 'Follow browser / region (default)' },
        ...i18n.getSupportedLocaleOptions().map(option => ({
            const: option.id,
            title: option.name,
        })),
    ];
}

function getLanguageSettingPageRender({ adminUserSettings }: UnknownRecord): UnknownRecord {
    return {
        id: 'languageSettingPage',
        title: 'Language',
        type: 'page',
        schema: {
            type: 'object',
            required: [],
            properties: {
                language: {
                    type: 'object',
                    title: 'Language',
                    properties: {
                        customizable: {
                            type: 'boolean',
                            title: 'Customizable by user'
                        },
                        value: {
                            type: 'string',
                            title: 'Value',
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
                submitText: 'Save',
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
