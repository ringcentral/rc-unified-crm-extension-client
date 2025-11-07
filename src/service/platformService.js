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
    await chrome.storage.local.remove('platform-info');
} 

exports.setPlatformInfo = setPlatformInfo;
exports.getPlatformInfo = getPlatformInfo;
exports.clearPlatformInfo = clearPlatformInfo;