async function onEvent({data}){
    // get region settings from widget  
    console.log('rc-region-settings-notify:', data);
    if (data.countryCode) {
      await chrome.storage.local.set(
        { selectedRegion: data.countryCode }
      )
    }
}

exports.onEvent = onEvent;