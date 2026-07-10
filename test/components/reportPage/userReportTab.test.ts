import getUserReportTabRender from '../../../src/components/reportPage/userReportTab.ts';

function basePage() {
  return {
    schema: {
      properties: {
        tab: { type: 'string' },
      },
    },
    uiSchema: {
      tab: { 'ui:widget': 'hidden' },
    },
    formData: {
      tab: 'user',
    },
  };
}

describe('userReportTab', () => {
  it('renders default current-user metrics and unlogged calls with fallback dates', () => {
    vi.setSystemTime(new Date('2026-07-03T08:00:00.000Z'));

    const page = getUserReportTabRender({
      page: basePage(),
      userStats: null,
      rcExtensions: [],
    });

    expect(page.schema.properties).not.toHaveProperty('rcExtensionList');
    expect(page.schema.properties).toHaveProperty('unloggedCallSummary');
    expect(page.formData).toMatchObject({
      tab: 'user',
      rcExtensionList: 'me',
      dateRangeEnums: 'Last 24 hours',
      startDate: '2026-07-02',
      endDate: '2026-07-03',
      unloggedCalls: [],
    });
    expect(page.schema.properties.phoneActivitySummary.oneOf).toEqual([
      expect.objectContaining({ const: 'inboundCallCount', value: '0', title: 'inbound call' }),
      expect.objectContaining({ const: 'outboundCallCount', value: '0', title: 'outbound call' }),
      expect.objectContaining({ const: 'answeredCallCount', value: '0', title: 'answered call' }),
      expect.objectContaining({ const: 'answeredCallPercentage', value: '0%' }),
    ]);
  });

  it('adds missing me option and renders selected extension custom date metrics', () => {
    const rcExtensions = [
      { id: 101, name: 'Jane Smith', email: 'jane@example.test', extensionNumber: '101' },
      { id: 102, firstName: 'Alex', lastName: 'Green', email: '', extensionNumber: '' },
    ];

    const page = getUserReportTabRender({
      page: basePage(),
      selectedRcExtension: '101',
      rcExtensions,
      userStats: {
        dateRange: 'Select date range...',
        startDate: '2026-07-01',
        endDate: '2026-07-03',
        callLogStats: {
          inboundCallCount: 2,
          outboundCallCount: 3,
          answeredCallCount: 4,
          answeredCallPercentage: '80%',
          totalTalkTime: 5,
          averageTalkTime: 6,
        },
        smsLogStats: {
          smsReceivedCount: 7,
          smsSentCount: 8,
        },
        unloggedCallStats: {
          unloggedCallCount: 9,
          calls: [{ sessionId: 'unlogged-1' }],
        },
      },
    });

    expect(rcExtensions).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'me', name: 'Me' }),
    ]));
    expect(page.schema.properties.rcExtensionList.enum).toEqual(['101', '102', 'me']);
    expect(page.schema.properties.rcExtensionList.enumNames).toEqual([
      'Jane Smith - jane@example.test (ext: 101)',
      'Alex Green  ',
      'Me  ',
    ]);
    expect(page.schema.properties).not.toHaveProperty('unloggedCallSummary');
    expect(page.schema.properties.startDate).toEqual({
      type: 'string',
      title: 'Start date',
      format: 'date',
    });
    expect(Object.keys(page.schema.properties).slice(0, 5)).toEqual([
      'tab',
      'rcExtensionList',
      'dateRangeEnums',
      'startDate',
      'endDate',
    ]);
    expect(page.formData).toMatchObject({
      rcExtensionList: '101',
      dateRangeEnums: 'Select date range...',
      startDate: '2026-07-01',
      endDate: '2026-07-03',
      unloggedCalls: [{ sessionId: 'unlogged-1' }],
    });
    expect(page.schema.properties.phoneActivitySummary.oneOf).toEqual([
      expect.objectContaining({ const: 'inboundCallCount', value: '2', title: 'inbound calls' }),
      expect.objectContaining({ const: 'outboundCallCount', value: '3', title: 'outbound calls' }),
      expect.objectContaining({ const: 'answeredCallCount', value: '4', title: 'answered calls' }),
      expect.objectContaining({ const: 'answeredCallPercentage', value: '80%' }),
    ]);
    expect(page.schema.properties.phoneEngagementSummary.oneOf).toEqual([
      expect.objectContaining({ const: 'totalTalkTime', value: '5', unit: 'minutes' }),
      expect.objectContaining({ const: 'averageTalkTime', value: '6', unit: 'minutes' }),
    ]);
    expect(page.schema.properties.smsActivitySummary.oneOf).toEqual([
      expect.objectContaining({ const: 'smsMessageReceivedCount', value: '7' }),
      expect.objectContaining({ const: 'smsMessageSentCount', value: '8' }),
    ]);
  });

  it('keeps an existing me option and renders singular engagement units', () => {
    const rcExtensions = [
      { id: 'me', name: 'Current User', email: 'me@example.test', extensionNumber: '100' },
    ];

    const page = getUserReportTabRender({
      page: basePage(),
      rcExtensions,
      userStats: {
        callLogStats: {
          totalTalkTime: 1,
          averageTalkTime: 1,
        },
        unloggedCallStats: {
          unloggedCallCount: 1,
          calls: [{ sessionId: 'unlogged-1' }],
        },
      },
    });

    expect(rcExtensions).toHaveLength(1);
    expect(page.formData.rcExtensionList).toBe('me');
    expect(page.schema.properties.unloggedCallSummary.oneOf).toEqual([
      expect.objectContaining({
        value: '1',
        title: 'unlogged calls',
      }),
    ]);
    expect(page.schema.properties.phoneEngagementSummary.oneOf).toEqual([
      expect.objectContaining({ const: 'totalTalkTime', value: '1', unit: 'minute' }),
      expect.objectContaining({ const: 'averageTalkTime', value: '1', unit: 'minute' }),
    ]);
  });
});
