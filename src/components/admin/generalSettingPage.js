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
                            title: "Click-to-dial Matcher"
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

exports.getGeneralSettingPageRender = getGeneralSettingPageRender;