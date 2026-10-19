type UnknownRecord = Record<string, any>;

export type CallLogReadinessReason = 'final-event' | 'complete-data-fallback' | 'incomplete';

export type CallLogReadinessState = {
  isReady: boolean;
  autoReady: boolean;
  manualReady: boolean;
  reason: CallLogReadinessReason;
  expiry: number;
  lastCheckedAt?: number;
};

type ResolveCallLogReadinessOptions = {
  call: UnknownRecord;
  previousState?: Partial<CallLogReadinessState>;
  explicitlyFinal: boolean;
  existingAutoDataReady: boolean;
  now?: number;
};

const READINESS_TTL_MS = 60000 * 60 * 24 * 30;

function isRecord(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasPartyAddress(party: unknown): boolean {
  if (!isRecord(party)) {
    return false;
  }
  return [party.phoneNumber, party.extensionNumber]
    .some((value) => typeof value === 'string' && value.trim().length > 0);
}

function hasValidStartTime(startTime: unknown): boolean {
  if (startTime instanceof Date) {
    return !Number.isNaN(startTime.getTime());
  }
  return typeof startTime === 'string'
    && startTime.trim().length > 0
    && !Number.isNaN(Date.parse(startTime));
}

export function isCallDataComplete(call: unknown): boolean {
  if (!isRecord(call)) {
    return false;
  }

  const sessionId = typeof call.sessionId === 'string' && call.sessionId.trim().length > 0;
  const direction = call.direction === 'Inbound' || call.direction === 'Outbound';
  const duration = typeof call.duration === 'number'
    && Number.isFinite(call.duration)
    && call.duration >= 0;
  const result = typeof call.result === 'string'
    && call.result.trim().length > 0
    && call.result.toLowerCase() !== 'ringing';
  const parties = isRecord(call.from) && isRecord(call.to);
  const contactParty = call.direction === 'Inbound' ? call.from : call.to;

  return sessionId
    && direction
    && hasValidStartTime(call.startTime)
    && duration
    && result
    && parties
    && hasPartyAddress(contactParty);
}

export function extractCallRecord(value: unknown): UnknownRecord | null {
  if (!isRecord(value)) {
    return null;
  }
  if (isRecord(value.call)) {
    return value.call;
  }
  if (isRecord(value.data) && isRecord(value.data.call)) {
    return value.data.call;
  }
  return value;
}

export function isManualLogReady(state: unknown): boolean {
  if (!isRecord(state)) {
    return false;
  }
  return state.manualReady ?? state.isReady ?? false;
}

export function resolveCallLogReadiness({
  call,
  previousState = {},
  explicitlyFinal,
  existingAutoDataReady,
  now = Date.now(),
}: ResolveCallLogReadinessOptions): CallLogReadinessState {
  const previousAutoReady = previousState.autoReady ?? previousState.isReady ?? false;
  const autoReady = previousAutoReady || (explicitlyFinal && existingAutoDataReady);
  const completeByFallback = isCallDataComplete(call);
  const previousManualReady = previousState.manualReady ?? previousAutoReady;
  const manualReady = previousManualReady || autoReady || completeByFallback;
  const reason: CallLogReadinessReason = autoReady
    ? 'final-event'
    : manualReady
      ? 'complete-data-fallback'
      : 'incomplete';

  return {
    isReady: autoReady,
    autoReady,
    manualReady,
    reason,
    expiry: now + READINESS_TTL_MS,
    ...(previousState.lastCheckedAt === undefined
      ? {}
      : { lastCheckedAt: previousState.lastCheckedAt }),
  };
}
