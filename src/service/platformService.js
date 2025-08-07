async function setPlatformInfo(){
    
}

async function getPlatformInfo() {
    const platformInfo = await chrome.storage.local.get('platform-info');
    return platformInfo?.['platform-info'];
  }

exports.setPlatformInfo = setPlatformInfo;
exports.getPlatformInfo = getPlatformInfo;