function getAdminReportTabRender({ page, adminStats }) {
    const schemaToAdd = {
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
                    value: (adminStats?.callLogStats?.inboundCallCount || 0).toString(),
                    title: (adminStats?.callLogStats?.inboundCallCount || 0) <= 1 ? 'inbound call' : 'inbound calls',
                    backgroundColor: '#a0a2a91f'
                },
                {
                    const: 'outboundCallCount',
                    value: (adminStats?.callLogStats?.outboundCallCount || 0).toString(),
                    title: (adminStats?.callLogStats?.outboundCallCount || 0) <= 1 ? 'outbound call' : 'outbound calls',
                    backgroundColor: '#a0a2a91f'
                },
                {
                    const: 'answeredCallCount',
                    value: (adminStats?.callLogStats?.answeredCallCount || 0).toString(),
                    title: (adminStats?.callLogStats?.answeredCallCount || 0) <= 1 ? 'answered call' : 'answered calls',
                    backgroundColor: '#a0a2a91f'
                },
                {
                    const: 'answeredCallPercentage',
                    value: (adminStats?.callLogStats?.answeredCallPercentage || '0%').toString(),
                    title: 'answered rate',
                    backgroundColor: '#a0a2a91f'
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
                    value: (adminStats?.callLogStats?.totalTalkTime || 0).toString(),
                    title: 'total talk time',
                    unit: (adminStats?.callLogStats?.totalTalkTime || 0) <= 1 ? 'minute' : 'minutes',
                    backgroundColor: '#a0a2a91f'
                },
                {
                    const: 'averageTalkTime',
                    value: (adminStats?.callLogStats?.averageTalkTime || 0).toString(),
                    title: 'average talk time',
                    unit: (adminStats?.callLogStats?.averageTalkTime || 0) <= 1 ? 'minute' : 'minutes',
                    backgroundColor: '#a0a2a91f'
                }
            ]
        },
    }

    const uiSchemaToAdd = {
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
        }
    }

    const formDataToAdd = {
        dateRangeEnums: adminStats?.dateRange || 'Last 24 hours',
        startDate: adminStats?.startDate || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        endDate: adminStats?.endDate || new Date(Date.now()).toISOString().split('T')[0]
    }
    // eslint-disable-next-line no-param-reassign
    page.schema.properties = { ...page.schema.properties, ...schemaToAdd };
    // eslint-disable-next-line no-param-reassign
    page.uiSchema = { ...page.uiSchema, ...uiSchemaToAdd };
    // eslint-disable-next-line no-param-reassign
    page.formData = { ...page.formData, ...formDataToAdd };
    if (adminStats?.dateRange === 'Select date range...') {
        const properties = { ...page.schema.properties };
        const { tab, dateRangeEnums, ...otherProperties } = properties;

        // eslint-disable-next-line no-param-reassign
        page.schema.properties = {
            tab,
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

export default getAdminReportTabRender;