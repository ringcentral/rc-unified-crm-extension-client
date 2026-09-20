function getAppConnect2AnnouncementPageRender() {
    const appConnect2AnnouncementPage = {
        id: 'appConnect2AnnouncementPage',
        title: 'Announcement',
        type: 'page',
        hideBackButton: true,
        schema: {
            type: 'object',
            properties: {
                announcementTitle: {
                    type: 'string',
                    description: 'App Connect 2.0 is almost here!'
                },
                announcementBody: {
                    type: 'string',
                    description: "You'll be automatically upgraded on October 8. No action is required."
                },
                announcementBody2: {
                    type: 'string',
                    description: 'Want to get ahead of it? Learn more about what\'s new in 2.0 and how to prepare below.'
                },
                learnMoreLink: {
                    type: 'string',
                    description: 'Learn more'
                },
                announcementDismissButton: {
                    type: 'string',
                    title: 'Dismiss'
                }
            }
        },
        uiSchema: {
            announcementTitle: {
                "ui:field": "typography",
                "ui:variant": "body2" // "caption1", "caption2", "body1", "body2", "subheading2", "subheading1", "title2", "title1"
            },
            announcementBody: {
                "ui:field": "typography",
                "ui:variant": "body1"
            },
            announcementBody2: {
                "ui:field": "typography",
                "ui:variant": "body1"
            },
            learnMoreLink: {
                "ui:field": "link",
                "ui:variant": "body1",
                "ui:underline": true,
                "ui:href": "https://community.ringcentral.com/integrations-app-connect-33/app-connect-2-0-is-coming-october-8-12077"
            },
            announcementDismissButton: {
                "ui:field": "button",
                "ui:variant": "outlined", // "text", "outlined", "contained", "plain"
                "ui:fullWidth": true
            }
        }
    };
    return appConnect2AnnouncementPage;
}

exports.getAppConnect2AnnouncementPageRender = getAppConnect2AnnouncementPageRender;
