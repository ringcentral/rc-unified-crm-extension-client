import { t } from '../i18n';

function getAboutPageRender({ manifest }) {
    const aboutPage = {
        id: 'aboutPage',
        title: t('pages.about.title'),
        type: 'page',
        schema: {
            type: 'object',
            properties: {
                introduction: {
                    type: "string",
                    description: t('pages.about.introduction'),
                },
                extensionInfoTitle: {
                    type: "string",
                    description: t('pages.about.chromeExtension')
                },
                extensionAuthorInfo: {
                    type: "string",
                    description: t('pages.about.extensionAuthor')
                },
                extensionVersionInfo: {
                    type: "string",
                    description: t('pages.about.versionLabel', { version: manifest.version })
                },
                endUserLicenseAgreement: {
                    type: "string",
                    description: t('pages.about.eula')
                },
                adapterInfoTitle: {
                    type: "string",
                    description: t('pages.about.adapter')
                },
                adapterAuthorInfo: {
                    type: "string",
                    description: t('pages.about.adapterAuthor', { author: manifest.author.name })
                },
                adapterWebsiteInfo: {
                    type: "string",
                    description: t('pages.about.website')
                },
                adapterSupportInfo: {
                    type: "string",
                    description: t('pages.about.support')
                }
            }
        },
        uiSchema: {
            introduction: {
                "ui:field": "typography"
            },
            extensionInfoTitle: {
                "ui:field": "typography",
                "ui:variant": "body2"
            },
            extensionAuthorInfo: {
                "ui:field": "typography",
                "ui:bulletedList": true,
            },
            extensionVersionInfo: {
                "ui:field": "typography",
                "ui:bulletedList": true,
            },
            endUserLicenseAgreement: {
                "ui:field": "link",
                "ui:variant": "body1",
                "ui:underline": true,
                "ui:href": "https://www.ringcentral.com/ca/en/a/legal/eulatos.html",
                "ui:bulletedList": true,
            },
            adapterInfoTitle: {
                "ui:field": "typography",
                "ui:variant": "body2"
            },
            adapterAuthorInfo: {
                "ui:field": "typography",
                "ui:bulletedList": true,
            },
            adapterWebsiteInfo: {
                "ui:field": "link",
                "ui:variant": "body1",
                "ui:underline": true,
                "ui:href": manifest.author.websiteUrl,
                "ui:bulletedList": true,
            },
            adapterSupportInfo: {
                "ui:field": "link",
                "ui:variant": "body1",
                "ui:underline": true,
                "ui:href": manifest.author.supportUrl,
                "ui:bulletedList": true,
            }
        }
    };
    return aboutPage;
}

exports.getAboutPageRender = getAboutPageRender;