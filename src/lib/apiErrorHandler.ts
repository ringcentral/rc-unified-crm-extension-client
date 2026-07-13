import authCore from '../core/auth';
import { showNotification } from './util';
import { trackCrmAuthFail } from './analytics';

type UnknownRecord = Record<string, any>;
type CrmAuthCacheClearedHandler = () => Promise<void> | void;

export const CRM_AUTH_REQUIRED_MESSAGE = 'Please go to Settings and authorize CRM platform';

let lastCrmAuthCacheClearTime = 0;
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
  isCrmAuthRequiredResponse,
  isCrmAuthRequiredError,
  handleCrmAuthRequiredResponse,
  handleApiError,
  registerCrmAuthCacheClearedHandler,
};

export default apiErrorHandler;
