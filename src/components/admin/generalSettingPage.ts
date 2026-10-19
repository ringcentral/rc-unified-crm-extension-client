import { t } from '../../i18n';

function getGeneralSettingPageRender() {
    return {
        id: 'generalSettings',
        title: t('pages.generalSettings.title'),
        type: 'page',
        schema: {
            type: 'object',
            required: [],
            properties: {
                section: {
                    type: "string",
                    oneOf: [
                        {
                            const: "appearance",
                            title: t('pages.generalSettings.appearance')
                        },
                        {
                            const: "clickToDialMatcher",
                            title: t('settings.clickToDialMatcher.name')
                        },
                        {
                            const: "clickToDialEmbed",
                            title: t('pages.generalSettings.enabledDomains')
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

export { getGeneralSettingPageRender };
export default {
    getGeneralSettingPageRender,
};
