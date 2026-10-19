import { t } from '../../../i18n';

function getAppearancePageRender() {
    return {
        id: 'appearancePage',
        title: t('pages.generalSettings.appearance'),
        type: 'page',
        schema: {
            type: 'object',
            required: [],
            properties: {
                section: {
                    type: "string",
                    oneOf: [
                        {
                            const: "customizeTabs",
                            title: t('settings.appearance.customizeTabs')
                        },
                        {
                            const: "widgetSettings",
                            title: t('settings.appearance.widgetSettings')
                        },
                        {
                            const: "notificationLevel",
                            title: t('settings.appearance.notificationLevel')
                        },
                        {
                            const: "language",
                            title: t('settings.appearance.language')
                        },
                        {
                            const: "phoneNumberFormat",
                            title: t('settings.appearance.phoneNumberFormat')
                        }
                    ]
                }
            }
        },
        uiSchema: {
            section: {
                "ui:field": "list",
                "ui:navigation": true,
            }
        }
    }
}

export { getAppearancePageRender };
export default {
    getAppearancePageRender,
};
