import userReportIcon from '../images/reportIcon.png';
import userReportIconActive from '../images/reportIcon_active.png';
import userReportIconDark from '../images/reportIcon_dark.png';

function getReportsPageRender({ userStats }) {
    const page = {
        id: 'reportPage',
        title: 'Reports',
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
                    title: 'Show date from the:',
                    enum: [
                        'Last 24 hours',
                        'Last 7 days',
                        'Last 30 days',
                        'Select date range...'
                    ],
                    default: 'Last 24 hours'
                },
                phoneActivityTitle: {
                    type: 'string',
                    description: 'Phone activity'
                },
                phoneActivitySummary: {
                    type: 'string',
                    oneOf: [
                        {
                            const: 'inboundCallCount',
                            value: (userStats.callLogStats?.inboundCallCount || 0).toString(),
                            title: 'inbound calls',
                            backgroundColor: '#ffffff'
                        },
                        {
                            const: 'outboundCallCount',
                            value: (userStats.callLogStats?.outboundCallCount || 0).toString(),
                            title: 'outbound calls',
                            backgroundColor: '#ffffff'
                        },
                        {
                            const: 'answeredCallCount',
                            value: (userStats.callLogStats?.answeredCallCount || 0).toString(),
                            title: 'answered calls',
                            backgroundColor: '#ffffff'
                        },
                        {
                            const: 'answeredCallPercentage',
                            value: (userStats.callLogStats?.answeredCallPercentage || '0%').toString(),
                            title: 'answered rate',
                            backgroundColor: '#ffffff'
                        }
                    ]
                },
                phoneEngagementTitle: {
                    type: 'string',
                    description: 'Phone engagement'
                },
                phoneEngagementSummary: {
                    type: 'string',
                    oneOf: [
                        {
                            const: 'totalTalkTime',
                            value: (userStats.callLogStats?.totalTalkTime || 0).toString(),
                            title: 'total talk time',
                            unit: 'minutes',
                            backgroundColor: '#ffffff'
                        },
                        {
                            const: 'averageTalkTime',
                            value: (userStats.callLogStats?.averageTalkTime || 0).toString(),
                            title: 'average talk time',
                            unit: 'minute',
                            backgroundColor: '#ffffff'
                        }
                    ]
                },
                smsActivityTitle: {
                    type: 'string',
                    description: 'SMS activity'
                },
                smsActivitySummary: {
                    type: 'string',
                    oneOf: [
                        {
                            const: 'smsMessageReceivedCount',
                            value: (userStats.smsLogStats?.smsReceivedCount || 0).toString(),
                            title: 'received sms',
                            backgroundColor: '#ffffff'
                        },
                        {
                            const: 'smsMessageSentCount',
                            value: (userStats.smsLogStats?.smsSentCount || 0).toString(),
                            title: 'sent sms',
                            backgroundColor: '#ffffff'
                        }
                    ]
                },
                unloggedCallTitle: {
                    type: 'string',
                    description: 'Unlogged calls'
                },
                unloggedCallSummary: {
                    type: 'string',
                    oneOf: [
                        {
                            const: 'unloggedCallCount',
                            value: (userStats.unloggedCallStats?.unloggedCallCount || 0).toString(),
                            trend: '(click to view)',
                            trendColor: 'success.f02',
                            title: 'unlogged calls',
                            backgroundColor: '#ffffff'
                        }
                    ]
                }
            }
        },
        uiSchema: {
            phoneActivityTitle: {
                "ui:field": "typography",
                "ui:variant": "body1"
            },
            phoneActivitySummary: {
                'ui:field': 'list',
                "ui:itemType": "metric",
                'ui:itemWidth': '48%',
                'ui:itemHeight': '100px',
                'ui:showSelected': false,
                'ui:readonly': true
            },
            phoneEngagementTitle: {
                "ui:field": "typography",
                "ui:variant": "body1"
            },
            phoneEngagementSummary: {
                'ui:field': 'list',
                "ui:itemType": "metric",
                'ui:itemWidth': '48%',
                'ui:itemHeight': '100px',
                'ui:showSelected': false,
                'ui:readonly': true
            },
            smsActivityTitle: {
                "ui:field": "typography",
                "ui:variant": "body1"
            },
            smsActivitySummary: {
                'ui:field': 'list',
                'ui:itemType': 'metric',
                'ui:itemWidth': '48%',
                'ui:itemHeight': '100px',
                'ui:showSelected': false,
                'ui:readonly': true
            },
            unloggedCallTitle: {
                "ui:field": "typography",
                "ui:variant": "body1"
            },
            unloggedCallSummary: {
                'ui:field': 'list',
                'ui:itemType': 'metric',
                'ui:itemWidth': '48%',
                'ui:itemHeight': '100px',
                'ui:showSelected': false
            }
        },
        formData: {
            dateRangeEnums: userStats?.dateRange || 'Last 24 hours',
            startDate: userStats?.startDate || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            endDate: userStats?.endDate || new Date(Date.now()).toISOString().split('T')[0]
        }
    }
    if (userStats?.dateRange === 'Select date range...') {
        const properties = { ...page.schema.properties };
        const { dateRangeEnums, ...otherProperties } = properties;
        
        page.schema.properties = {
            dateRangeEnums,
            startDate: {
                type: 'string',
                title: 'Start date',
                format: 'date'
            },
            endDate: {
                type: 'string',
                title: 'End date',
                format: 'date'
            },
            ...otherProperties
        };
    }
    return page;
}

exports.getReportsPageRender = getReportsPageRender;