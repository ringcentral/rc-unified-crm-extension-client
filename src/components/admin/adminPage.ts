import adminIcon from '../../images/adminIcon.png';
import adminIconActive from '../../images/adminIcon_active.png';
import adminIconDark from '../../images/adminIcon_dark.png';
import { t } from '../../i18n';
import authCore from '../../core/auth';
import { getPlatformAccountDataKeys } from '../../lib/accountData';

type UnknownRecord = Record<string, any>;

function getAdminPageRender({ platform }: UnknownRecord): UnknownRecord {
    const hasManagedAuthFields = platform.auth?.type === 'apiKey'
        && (platform.auth?.apiKey?.page?.content ?? []).some((field: UnknownRecord) => field?.managed);
    const hasManagedOAuth = authCore.isAdminManagedOAuthEnabled(platform);
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
                        ...(platform.adminSettings?.length > 0 ? [{
                            const: "accountSettings",
                            title: 'Account settings',
                        }] : []),
                        ...(getPlatformAccountDataKeys(platform).length > 0 ? [{
                            const: "accountData",
                            title: 'Account data',
                        }] : []),
                        ...hasManagedAuthFields ? [{
                            const: "managedAuthentication",
                            title: 'Managed authentication',
                        }] : [],
                        ...hasManagedOAuth ? [{
                            const: "managedOAuth",
                            title: 'Managed OAuth',
                        }] : [],
                        ...platform.serverSideLogging ? [{
                            const: "serverSideLoggingSetting",
                            title: t('pages.admin.serverSideLogging'),
                        }] : [],
                        // Always shown: adoption stats apply to every connector. Older connector
                        // servers are handled inside the section page with an unsupported notice.
                        {
                            const: "extensionAdoption",
                            title: t('pages.admin.extensionAdoption'),
                        },
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

export { getAdminPageRender };
export default {
    getAdminPageRender,
};
