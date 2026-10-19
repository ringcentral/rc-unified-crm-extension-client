import {
  extractCallRecord,
  isCallDataComplete,
  isManualLogReady,
  resolveCallLogReadiness,
} from '../../src/lib/callLogReadiness';

function completeCall(overrides: Record<string, any> = {}) {
  return {
    sessionId: 'session-1',
    startTime: '2026-08-21T01:00:00.000Z',
    duration: 0,
    direction: 'Inbound',
    result: 'Completed',
    from: { phoneNumber: '+16505550100' },
    to: { extensionNumber: '101' },
    ...overrides,
  };
}

describe('call log readiness', () => {
  it('accepts complete terminal call data without an action marker', () => {
    expect(isCallDataComplete(completeCall())).toBe(true);
  });

  it.each([
    ['missing start time', { startTime: undefined }],
    ['negative duration', { duration: -1 }],
    ['ringing result', { result: 'Ringing' }],
    ['missing contact address', { from: { name: 'Anonymous' } }],
  ])('rejects %s', (_label, overrides) => {
    expect(isCallDataComplete(completeCall(overrides))).toBe(false);
  });

  it('keeps automatic readiness strict while enabling the manual fallback', () => {
    const readiness = resolveCallLogReadiness({
      call: completeCall(),
      explicitlyFinal: false,
      existingAutoDataReady: true,
      now: 1000,
    });

    expect(readiness).toMatchObject({
      isReady: false,
      autoReady: false,
      manualReady: true,
      reason: 'complete-data-fallback',
    });
    expect(isManualLogReady(readiness)).toBe(true);
  });

  it('keeps the existing final-event path ready for automatic logging', () => {
    expect(resolveCallLogReadiness({
      call: completeCall({ action: 'Phone Call' }),
      explicitlyFinal: true,
      existingAutoDataReady: true,
    })).toMatchObject({
      isReady: true,
      autoReady: true,
      manualReady: true,
      reason: 'final-event',
    });
  });

  it('extracts adapter call records from supported response shapes', () => {
    const call = completeCall();
    expect(extractCallRecord({ call })).toBe(call);
    expect(extractCallRecord({ data: { call } })).toBe(call);
    expect(extractCallRecord(call)).toBe(call);
  });
});
