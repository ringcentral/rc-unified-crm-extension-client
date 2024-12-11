function getAboutPageRender({ manifest }) {
    const aboutPage = {
        id: 'aboutPage',
        title: 'About',
        type: 'page',
        schema: {
            type: 'object',
            properties: {
                introduction: {
                    type: "string",
                    description: "The RingCentral CRM extension embeds a fully-functional web phone into a set of supported CRM platforms.",
                },
                extensionInfoTitle: {
                    type: "string",
                    description: "Chrome extension"
                },
                extensionAuthorInfo: {
                    type: "string",
                    description: "Author: RingCentral, Inc."
                },
                extensionVersionInfo: {
                    type: "string",
                    description: `Version: ${manifest.version}`
                },
                endUserLicenseAgreement: {
                    type: "string",
                    description: "End User License Agreement"
                },
                adapterInfoTitle: {
                    type: "string",
                    description: "Adapter"
                },
                adapterAuthorInfo: {
                    type: "string",
                    description: `Author: ${manifest.author.name}`
                },
                adapterWebsiteInfo: {
                    type: "string",
                    description: "Website"
                },
                adapterSupportInfo: {
                    type: "string",
                    description: "Support"
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