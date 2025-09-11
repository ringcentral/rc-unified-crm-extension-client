
import userCore from '../../core/user';
import userReportIcon from '../../images/reportIcon.png';
import userReportIconActive from '../../images/reportIcon_active.png';
import userReportIconDark from '../../images/reportIcon_dark.png';

import getMyReportTabRender from './myReportTab';

function getReportsPageRender({ selectedTab = 'myReportsTab', userStats, userSettings }) {
    const isHidden = !userCore.getShowUserReportTabSetting(userSettings)?.value;
    let page = {
        id: 'reportPage',
        title: 'Reports',
        type: 'tab',
        priority: 105,
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
                    enum: ['myReportsTab', 'adminReportsTab', 'leaderboardTab'],
                    enumNames: ['My Reports', 'Admin Reports', 'Leaderboard']
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
        case 'myReportsTab':
            page = getMyReportTabRender({ page, userStats, userSettings });
            break;
        case 'adminReportsTab':
            break;
        case 'leaderboardTab':
            break;
    }

    return page;
}

exports.getReportsPageRender = getReportsPageRender;