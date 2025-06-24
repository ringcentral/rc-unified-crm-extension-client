import userReportIcon from '../images/reportIcon.png';
import userReportIconActive from '../images/reportIcon_active.png';
import userReportIconDark from '../images/reportIcon_dark.png';

function getUserReportPageRender({ userStats }) {
    const page = {
        id: 'userReportPage',
        title: 'User report',
        type: 'tab',
        priority: 105,
        iconUri: userReportIcon,
        activeIconUri: userReportIconActive,
        darkIconUri: userReportIconDark,
        schema: {
            type: 'object',
            properties: {
                dateRangeEnums: {
                    type: 'string',
                    title: 'Date range',
                    enum: [
                        'Day',
                        'Week',
                        'Month'
                    ]
                },
                phoneActivityTitle: {
                    type: 'string',
                    description: 'Phone Activity Summary'
                },
                phoneActivitySummary: {
                    type: 'string',
                    oneOf: [
                        {
                            const: 'inboundCallCount',
                            title: userStats.callLogStats.inboundCallCount,
                            description: 'Inbound',
                            backgroundColor: '#ffffff'
                        },
                        {
                            const: 'outboundCallCount',
                            title: userStats.callLogStats.outboundCallCount,
                            description: 'Outbound',
                            backgroundColor: '#ffffff'
                        },
                        {
                            const: 'answeredCallCount',
                            title: userStats.callLogStats.answeredCallCount,
                            description: 'Answered',
                            backgroundColor: '#ffffff'
                        },
                        {
                            const: 'answeredCallPercentage',
                            title: userStats.callLogStats.answeredCallPercentage,
                            description: 'Answered %',
                            backgroundColor: '#ffffff'
                        }
                    ]
                },
                smsActivityTitle: {
                    type: 'string',
                    description: 'SMS Activity Summary'
                },
                smsActivitySummary: {
                    type: 'string',
                    oneOf: [
                        {
                            const: 'smsMessageReceivedCount',
                            title: userStats.smsLogStats.smsReceivedCount,
                            description: 'Received',
                            backgroundColor: '#ffffff'
                        },
                        {
                            const: 'smsMessageSentCount',
                            title: userStats.smsLogStats.smsSentCount,
                            description: 'Sent',
                            backgroundColor: '#ffffff'
                        },
                        {
                            const: 'smsMessageConversationsLoggedCount',
                            title: '55',
                            description: 'Logged',
                            backgroundColor: '#ffffff'
                        }
                    ]
                },
                unloggedCallTitle: {
                    type: 'string',
                    description: 'Unlogged Calls'
                },
                unloggedCallSummary: {
                    type: 'string',
                    oneOf: [
                        {
                            const: 'unloggedCallCount',
                            title: userStats.unloggedCallStats?.unloggedCallCount || 0,
                            description: 'Total (click to view)',
                            backgroundColor: '#ffffff'
                        }
                    ]
                },
                topAgentsTitle: {
                    type: 'string',
                    description: 'Top Agents'
                },
                topAgentsSummary: {
                    type: 'string',
                    oneOf: [
                        {
                            const: 'topAgentDay',
                            title: 'John Doe',
                            description: '24 hour',
                            backgroundColor: '#ffffff'
                        },
                        {
                            const: 'topAgentWeek',
                            title: 'John Doe',
                            description: '7 day',
                            backgroundColor: '#ffffff'
                        },
                        {
                            const: 'topAgentMonth',
                            title: 'John Doe',
                            description: '30 day',
                            backgroundColor: '#ffffff'
                        }
                    ]
                }
            }
        },
        uiSchema: {
            dateRangeEnums: {
                "ui:widget": "radio",
                "ui:itemDirection": "row"
            },
            phoneActivityTitle: {
                "ui:field": "typography",
                "ui:variant": "h6"
            },
            phoneActivitySummary: {
                'ui:field': 'list',
                'ui:itemType': 'card',
                'ui:itemWidth': '25%',
                'ui:itemHeight': '70px',
                'ui:showSelected': false,
                'ui:readonly': true
            },
            smsActivityTitle: {
                "ui:field": "typography",
                "ui:variant": "h6"
            },
            smsActivitySummary: {
                'ui:field': 'list',
                'ui:itemType': 'card',
                'ui:itemWidth': '25%',
                'ui:itemHeight': '70px',
                'ui:showSelected': false,
                'ui:readonly': true
            },
            unloggedCallTitle: {
                "ui:field": "typography",
                "ui:variant": "h6"
            },
            unloggedCallSummary: {
                'ui:field': 'list',
                'ui:itemType': 'card',
                'ui:itemWidth': '35%',
                'ui:itemHeight': '70px',
                'ui:showSelected': false
            },
            topAgentsTitle: {
                "ui:field": "typography",
                "ui:variant": "h6"
            },
            topAgentsSummary: {
                'ui:field': 'list',
                'ui:itemType': 'card',
                'ui:itemWidth': '25%',
                'ui:itemHeight': '70px',
                'ui:showSelected': false,
                'ui:readonly': true
            }
        },
        formData: {
            dateRangeEnums: userStats?.dateRange || 'Day'
        }
    }
    return page;
}

exports.getUserReportPageRender = getUserReportPageRender;