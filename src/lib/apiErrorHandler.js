import authCore from '../core/auth';
import { showNotification } from './util';
import { trackCrmAuthFail } from './analytics';

export const CRM_AUTH_REQUIRED_MESSAGE = 'Please go to Settings and authorize CRM platform';

let lastCrmAuthCacheClearTime = 0;
let onCrmAuthCacheCleared = null;

function getResponseBodyMessage(data) {
    if (!data) {
        return '';
    }
    if (typeof data === 'string') {
        return data;
    }
    if (typeof data.message === 'string') {
        return data.message;
    }
    if (typeof data.returnMessage?.message === 'string') {
        return data.returnMessage.message;
    }
    return '';
}

function isCrmAuthRequiredResponse(response) {
    if (!response || response.status !== 400) {
        return false;
    }
    const message = getResponseBodyMessage(response.data);
    return message.includes('authorize CRM platform');
}

function isCrmAuthRequiredError(error) {
    return isCrmAuthRequiredResponse(error?.response);
}

function registerCrmAuthCacheClearedHandler(callback) {
    onCrmAuthCacheCleared = callback;
}

async function handleCrmAuthRequiredResponse({ showUserNotification = true } = {}) {
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
            ttl: 60000
        });
    }
    return true;
}

async function handleApiError(error, options = {}) {
    if (!isCrmAuthRequiredError(error)) {
        return false;
    }
    return handleCrmAuthRequiredResponse(options);
}

export default {
    CRM_AUTH_REQUIRED_MESSAGE,
    isCrmAuthRequiredResponse,
    isCrmAuthRequiredError,
    handleCrmAuthRequiredResponse,
    handleApiError,
    registerCrmAuthCacheClearedHandler,
};
