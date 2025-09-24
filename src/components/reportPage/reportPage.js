
import userCore from '../../core/user';
import userReportIcon from '../../images/reportIcon.png';
import userReportIconActive from '../../images/reportIcon_active.png';
import userReportIconDark from '../../images/reportIcon_dark.png';

import getUserReportTabRender from './userReportTab';
import getCompanyReportTabRender from './companyReportTab';

function getReportsPageRender({ selectedTab = 'userReportTab', selectedRcExtension, userStats, companyStats, userSettings, rcExtensions = [] }) {
    const isHidden = !userCore.getShowUserReportTabSetting(userSettings)?.value;
    let page = {
        id: 'reportPage',
        title: 'Reports',
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
                    enum: ['userReportTab', 'companyReportTab'],
                    enumNames: ['User stats', 'Company stats']
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
            page = getCompanyReportTabRender({ page, companyStats });
            break;
    }

    return page;
}

exports.getReportsPageRender = getReportsPageRender;