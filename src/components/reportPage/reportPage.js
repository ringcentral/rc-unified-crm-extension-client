
import userCore from '../../core/user';
import userReportIcon from '../../images/reportIcon.png';
import userReportIconActive from '../../images/reportIcon_active.png';
import userReportIconDark from '../../images/reportIcon_dark.png';
import { t } from '../../i18n';

import getUserReportTabRender from './userReportTab';
import getCompanyReportTabRender from './companyReportTab';

function getReportsPageRender({ selectedTab = 'userReportTab', selectedRcExtension, isAdmin = false, isFeatureEnabled = false, userStats, companyStats, selectedGroupKey, groupKeys, selectedItemKey, itemKeys, userSettings, rcExtensions = [] }) {
    const isHidden = !userCore.getShowUserReportTabSetting(userSettings)?.value;
    let page = {
        id: 'reportPage',
        title: t('pages.reports.title'),
        type: 'tab',
        priority: 66,
        hidden: isHidden,
        iconUri: userReportIcon,
        activeIconUri: userReportIconActive,
        darkIconUri: userReportIconDark,
        schema: {
            type: 'object',
            properties: {
                tab: {
                    type: 'string',
                    title: 'Tab',
                    enum: ['userReportTab'].concat(isAdmin && isFeatureEnabled ? ['companyReportTab'] : []),
                    enumNames: [t('pages.reports.userStats')].concat(isAdmin && isFeatureEnabled ? [t('pages.reports.companyStats')] : [])
                }
            }
        },
        uiSchema: {
            tab: {
                "ui:widget": "radio",
                "ui:inline": true,
                "ui:tab": true
            }
        },
        formData: {
            tab: selectedTab,
        }
    }
    switch (selectedTab) {
        case 'userReportTab':
            page = getUserReportTabRender({ page, userStats, userSettings, rcExtensions, selectedRcExtension });
            break;
        case 'companyReportTab':
            page = getCompanyReportTabRender({ page, companyStats, selectedGroupKey, groupKeys, selectedItemKey, itemKeys });
            break;
    }

    return page;
}

exports.getReportsPageRender = getReportsPageRender;