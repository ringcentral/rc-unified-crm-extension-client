import authCore from '../core/auth';
import { getPlatformInfo } from '../service/platformService';
import { showNotification } from './util';
import { trackCrmAuthFail } from './analytics';

type UnknownRecord = Record<string, any>;
type CrmAuthCacheClearedHandler = () => Promise<void> | void;

export const CRM_AUTH_REQUIRED_MESSAGE = 'Please go to Settings and authorize CRM platform';

// Unique: Pipedrive - direct OAuth is a single popup, so an expired session can prompt it right away
const AUTO_RECONNECT_PLATFORMS = ['pipedrive'];
const AUTO_RECONNECT_COOLDOWN_MS = 5 * 60 * 1000;
export const CRM_RECONNECT_MESSAGE = 'Your CRM session has expired. Please authorize again in the pop-up window.';

let lastCrmAuthCacheClearTime = 0;
let lastAutoReconnectTime = 0;
let onCrmAuthCacheCleared: CrmAuthCacheClearedHandler | null = null;

function getResponseBodyMessage(data: unknown): string {
  if (!data) {
    return '';
  }
  if (typeof data === 'string') {
    return data;
  }
  if (typeof (data as UnknownRecord).message === 'string') {
    return (data as UnknownRecord).message;
  }
  if (typeof (data as UnknownRecord).returnMessage?.message === 'string') {
    return (data as UnknownRecord).returnMessage.message;
  }
  return '';
}

export function isCrmAuthRequiredResponse(response: UnknownRecord | null | undefined): boolean {
  if (!response || response.status !== 400) {
    return false;
  }
  const message = getResponseBodyMessage(response.data);
  return message.includes('authorize CRM platform');
}

export function isCrmAuthRequiredError(error: UnknownRecord | null | undefined): boolean {
  return isCrmAuthRequiredResponse(error?.response);
}

export function registerCrmAuthCacheClearedHandler(callback: CrmAuthCacheClearedHandler): void {
  onCrmAuthCacheCleared = callback;
}

async function isAutoReconnectPlatform(): Promise<boolean> {
  const platformInfo = await getPlatformInfo();
  return AUTO_RECONNECT_PLATFORMS.includes(platformInfo?.platformName ?? '');
}

// Callers must have cleared the local CRM auth state first: the Pipedrive callback ignores a new
// code while a JWT is still stored. The cooldown also drops stale responses that arrive after a
// successful reconnect, which would otherwise clear the fresh session.
export async function requestAutoReconnect(): Promise<boolean> {
  if (!(await isAutoReconnectPlatform())) {
    return false;
  }
  const now = Date.now();
  if (now - lastAutoReconnectTime < AUTO_RECONNECT_COOLDOWN_MS) {
    return false;
  }
  lastAutoReconnectTime = now;
  showNotification({ level: 'warning', message: CRM_RECONNECT_MESSAGE, ttl: 10000 });
  await authCore.onUserClickConnectButton({});
  return true;
}

// In-band failures (HTTP 200) carry CRM_SESSION_INVALID instead of an error status.
export async function handleSessionInvalidResponse(response: UnknownRecord | null | undefined): Promise<boolean> {
  if (response?.data?.errorCode !== 'CRM_SESSION_INVALID' || !(await isAutoReconnectPlatform())) {
    return false;
  }
  return handleCrmAuthRequiredResponse({ showUserNotification: false });
}

export async function handleCrmAuthRequiredResponse({ showUserNotification = true }: { showUserNotification?: boolean } = {}): Promise<boolean> {
  const now = Date.now();
  if (now - lastCrmAuthCacheClearTime < 5000) {
    return false;
  }
  const cleared = await authCore.clearLocalCrmAuthState();
  if (!cleared) {
    return false;
  }
  lastCrmAuthCacheClearTime = now;
  trackCrmAuthFail();
  if (onCrmAuthCacheCleared) {
    await onCrmAuthCacheCleared();
  }
  if (await requestAutoReconnect()) {
    return true;
  }
  if (showUserNotification) {
    showNotification({
      level: 'warning',
      message: CRM_AUTH_REQUIRED_MESSAGE,
      ttl: 60000,
    });
  }
  return true;
}

export async function handleApiError(error: UnknownRecord, options: { showUserNotification?: boolean } = {}): Promise<boolean> {
  if (!isCrmAuthRequiredError(error)) {
    return false;
  }
  return handleCrmAuthRequiredResponse(options);
}

const apiErrorHandler = {
  CRM_AUTH_REQUIRED_MESSAGE,
  CRM_RECONNECT_MESSAGE,
  isCrmAuthRequiredResponse,
  isCrmAuthRequiredError,
  handleCrmAuthRequiredResponse,
  handleSessionInvalidResponse,
  requestAutoReconnect,
  handleApiError,
  registerCrmAuthCacheClearedHandler,
};

export default apiErrorHandler;
