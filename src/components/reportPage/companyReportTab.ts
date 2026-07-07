type UnknownRecord = Record<string, any>;

function getCompanyReportTabRender({ page, companyStats, selectedGroupKey, groupKeys, selectedItemKey, itemKeys }: UnknownRecord): UnknownRecord {
    if (!selectedItemKey || !itemKeys?.includes(selectedItemKey)) {
        // eslint-disable-next-line no-param-reassign
        selectedItemKey = itemKeys?.[0] || '';
    }
    // essentially this category/group is unavailable for this account
    if (itemKeys?.length === 0) {
        // eslint-disable-next-line no-param-reassign
        itemKeys = ['N/A'];
        // eslint-disable-next-line no-param-reassign
        selectedItemKey = 'N/A';
    }
    const selectedStats = companyStats?.callLogStats?.find(stat => stat.name === selectedItemKey);
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
        groupKeyEnums: {
            type: 'string',
            title: 'Group',
            enum: [
                ...groupKeys
            ]
        },
        itemKeyEnums: {
            type: 'string',
            title: 'Item',
            enum: [
                ...itemKeys
            ]
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
                    value: (selectedStats?.inboundCallCount ?? 'N/A').toString(),
                    title: (selectedStats?.inboundCallCount ?? 'N/A') <= 1 ? 'inbound call' : 'inbound calls',
                    backgroundColor: '#a0a2a91f'
                },
                {
                    const: 'outboundCallCount',
                    value: (selectedStats?.outboundCallCount ?? 'N/A').toString(),
                    title: (selectedStats?.outboundCallCount ?? 'N/A') <= 1 ? 'outbound call' : 'outbound calls',
                    backgroundColor: '#a0a2a91f'
                },
                {
                    const: 'answeredCallCount',
                    value: (selectedStats?.answeredCallCount ?? 'N/A').toString(),
                    title: (selectedStats?.answeredCallCount ?? 'N/A') <= 1 ? 'answered call' : 'answered calls',
                    backgroundColor: '#a0a2a91f'
                },
                {
                    const: 'answeredCallPercentage',
                    value: (selectedStats?.answeredCallPercentage ?? 'N/A').toString(),
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
                    value: (selectedStats?.totalTalkTime ?? 'N/A').toString(),
                    title: 'total talk time',
                    unit: (selectedStats?.totalTalkTime ?? 'N/A') <= 1 ? 'minute' : 'minutes',
                    backgroundColor: '#a0a2a91f'
                },
                {
                    const: 'averageTalkTime',
                    value: (selectedStats?.averageTalkTime ?? 'N/A').toString(),
                    title: 'average talk time',
                    unit: (selectedStats?.averageTalkTime ?? 'N/A') <= 1 ? 'minute' : 'minutes',
                    backgroundColor: '#a0a2a91f'
                }
            ]
        },
    }

    const uiSchemaToAdd: UnknownRecord = {
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
    if (selectedItemKey === 'N/A') {
        uiSchemaToAdd.itemKeyEnums = {
            'ui:readonly': true
        }
    }

    let smsSchemaToAdd: UnknownRecord = {}
    let smsUiSchemaToAdd: UnknownRecord = {};
    let smsFormDataToAdd: UnknownRecord = {};
    if (companyStats?.smsLogStats) {
        smsSchemaToAdd = {
            smsActivityTitle: {
                type: 'string',
                description: 'SMS activity'
            },
            smsActivitySummary: {
                type: 'string',
                oneOf: [
                    {
                        const: 'smsMessageReceivedCount',
                        value: (selectedStats?.smsReceivedCount ?? 'N/A').toString(),
                        title: 'received sms',
                        backgroundColor: '#a0a2a91f'
                    },
                    {
                        const: 'smsMessageSentCount',
                        value: (selectedStats?.smsSentCount ?? 'N/A').toString(),
                        title: 'sent sms',
                        backgroundColor: '#a0a2a91f'
                    }
                ]
            }
        };
        smsUiSchemaToAdd = {
            smsActivityTitle: {
                "ui:field": "typography",
                "ui:variant": "body1"
            },
            smsActivitySummary: {
                'ui:field': 'list',
                "ui:itemType": "metric",
                'ui:itemWidth': '48%',
                'ui:itemHeight': '100px',
                'ui:showSelected': false,
                'ui:readonly': true
            }
        };
        smsFormDataToAdd = {
            smsActivitySummary: 'smsMessageReceivedCount'
        };
    }

    const formDataToAdd = {
        dateRangeEnums: companyStats?.dateRange || 'Last 24 hours',
        groupKeyEnums: selectedGroupKey || groupKeys?.[0] || '',
        itemKeyEnums: selectedItemKey,
        startDate: companyStats?.startDate || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        endDate: companyStats?.endDate || new Date(Date.now()).toISOString().split('T')[0],
        companyStats
    }
    // eslint-disable-next-line no-param-reassign
    page.schema.properties = { ...page.schema.properties, ...schemaToAdd, ...smsSchemaToAdd };
    // eslint-disable-next-line no-param-reassign
    page.uiSchema = { ...page.uiSchema, ...uiSchemaToAdd, ...smsUiSchemaToAdd };
    // eslint-disable-next-line no-param-reassign
    page.formData = { ...page.formData, ...formDataToAdd, ...smsFormDataToAdd };
    if (companyStats?.dateRange === 'Select date range...') {
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

export default getCompanyReportTabRender;
