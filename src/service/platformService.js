let sessionPlatformInfo = null;

async function setPlatformInfo({ platformInfo }){
    sessionPlatformInfo = platformInfo;
}

async function getPlatformInfo() {
    if (sessionPlatformInfo) {
        return sessionPlatformInfo;
    }
    const platformInfo = await chrome.storage.local.get('platform-info');
    sessionPlatformInfo = platformInfo?.['platform-info'];
    return sessionPlatformInfo;
  }

async function clearPlatformInfo() {
    sessionPlatformInfo = null;
    await chrome.storage.local.remove('serverSideLoggingToken');
    await chrome.storage.local.remove('isAdmin');
    await chrome.storage.local.remove('crmAuthed');
    await chrome.storage.local.remove('platform-info');
    await chrome.storage.local.remove('crm_extension_bullhornUsername');
    await chrome.storage.local.remove('crm_extension_bullhorn_user_urls');
} 

exports.setPlatformInfo = setPlatformInfo;
exports.getPlatformInfo = getPlatformInfo;
exports.clearPlatformInfo = clearPlatformInfo;