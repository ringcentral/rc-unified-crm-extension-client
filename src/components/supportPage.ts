import { t } from '../i18n';

function getSupportPageRender({ manifest, platformName, isOnline, rcAccountId }) {
    const supportPage = {
        id: 'supportPage',
        title: t('pages.support.title'),
        type: 'page',
        schema: {
            type: 'object',
            properties: {
                documentation: {
                    type: "string",
                    description: t('pages.support.documentation')
                },
                releaseNotes: {
                    type: "string",
                    description: t('pages.support.releaseNotes')
                },
                getSupport: {
                    type: "string",
                    description: t('pages.support.getSupport')
                },
                writeReview: {
                    type: "string",
                    description: t('pages.support.writeReview')
                },
                openCommunityPageButton: {
                    type: "string",
                    description: t('pages.support.communityForums'),
                },
                isServiceOnline: {
                    type: "string",
                    description: t('pages.support.serverStatus', { status: isOnline ? t('common.status.online') : t('common.status.offline') })
                },
                rcAccountId: {
                    type: "string",
                    description: t('pages.support.rcAccountIdLabel', { accountId: rcAccountId || 'N/A' })
                },
                version: {
                    type: "string",
                    description: t('pages.support.versionLabel', { version: manifest.version })
                },
                ...(manifest.platforms[platformName].supportReportIssue ? {
                    reportIssueButton: {
                        type: "string",
                        title: t('pages.support.sendErrorReport'),
                    }
                } : {}),
                clearLogConflictsButton: {
                    type: "string",
                    title: t('pages.support.clearLogConflicts'),
                },
                factoryResetWarning: {
                    type: "string",
                    description: t('pages.support.factoryResetWarning')
                },
                factoryResetButton: {
                    type: "string",
                    title: t('pages.support.factoryReset'),
                }
            }
        },
        uiSchema: {
            documentation: {
                "ui:field": "link",
                "ui:variant": "body1",
                "ui:underline": true
            },
            releaseNotes: {
                "ui:field": "link",
                "ui:variant": "body1",
                "ui:underline": true
            },
            getSupport: {
                "ui:field": "link",
                "ui:variant": "body1",
                "ui:underline": true
            },
            writeReview: {
                "ui:field": "link",
                "ui:variant": "body1",
                "ui:underline": true
            },
            openCommunityPageButton: {
                "ui:field": "link",
                "ui:variant": "body1",
                "ui:underline": true
            },
            version: {
                "ui:field": "typography",
                "ui:variant": "body2", // "caption1", "caption2", "body1", "body2", "subheading2", "subheading1", "title2", "title1"
                "ui:align": "center"
            },
            isServiceOnline: {
                "ui:field": "typography",
                "ui:variant": "body2", // "caption1", "caption2", "body1", "body2", "subheading2", "subheading1", "title2", "title1"
            },
            rcAccountId: {
                "ui:field": "typography",
                "ui:variant": "body2", // "caption1", "caption2", "body1", "body2", "subheading2", "subheading1", "title2", "title1"
            },
            reportIssueButton: {
                "ui:field": "button",
                "ui:variant": "outlined", // "text", "outlined", "contained", "plain"
                "ui:fullWidth": false
            },
            clearLogConflictsButton: {
                "ui:field": "button",
                "ui:variant": "outlined", // "text", "outlined", "contained", "plain"
                "ui:fullWidth": false,
                "ui:color": "danger.b03"
            },
            factoryResetWarning: {
                "ui:field": "admonition",
                "ui:severity": "warning",  // "warning", "info", "error", "success"
            },
            factoryResetButton: {
                "ui:field": "button",
                "ui:variant": "outlined", // "text", "outlined", "contained", "plain"
                "ui:fullWidth": false,
                "ui:color": "danger.b03"
            },
        }
    }
    return supportPage;
}

export { getSupportPageRender };
export default {
    getSupportPageRender,
};
