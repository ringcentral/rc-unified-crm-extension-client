import adminIcon from '../../images/adminIcon.png';
import adminIconActive from '../../images/adminIcon_active.png';
import adminIconDark from '../../images/adminIcon_dark.png';
import { t } from '../../i18n';

function getAdminPageRender({ platform }) {
    const hasSharedAuthFields = platform.auth?.type === 'apiKey'
        && (platform.auth?.apiKey?.page?.content ?? []).some(field => field?.shared);
    const page = {
        id: 'adminPage',
        title: t('pages.admin.title'),
        type: 'tab',
        priority: 65,
        iconUri: adminIcon, // icon for tab, 24x24
        activeIconUri: adminIconActive, // icon for tab in active status, 24x24,
        darkIconUri: adminIconDark,
        schema: {
            type: 'object',
            reuiqred: [],
            properties: {
                section: {
                    type: "string",
                    oneOf: [
                        {
                            const: "managedSettings",
                            title: t('pages.admin.managedSettings'),
                        },
                        ...hasSharedAuthFields ? [{
                            const: "sharedAuthentication",
                            title: 'Shared authentication',
                        }] : [],
                        ...platform.serverSideLogging ? [{
                            const: "serverSideLoggingSetting",
                            title: t('pages.admin.serverSideLogging'),
                        }] : [],
                        {
                            const: "plugins",
                            title: t('pages.admin.plugins'),
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

    return page;
}

exports.getAdminPageRender = getAdminPageRender;
