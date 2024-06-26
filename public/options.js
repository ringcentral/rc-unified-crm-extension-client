let timerId = '';

// Saves options to chrome.storage
const saveOptions = () => {
    const customCrmManifestUrl = document.getElementById('customCrmManifestUrl').value;
    const c2dDelay = document.getElementById('c2dDelay').value;
    const autoLogCountdown = document.getElementById('autoLogCountdown').value;
    const bullhornDefaultActionCode = document.getElementById('bullhornDefaultActionCode').value;
    const renderQuickAccessButton = document.getElementById('renderQuickAccessButton').checked;
    const overridingPhoneNumberFormat = document.getElementById('overridingPhoneNumberFormat').value;
    const overridingPhoneNumberFormat2 = document.getElementById('overridingPhoneNumberFormat2').value;
    const overridingPhoneNumberFormat3 = document.getElementById('overridingPhoneNumberFormat3').value;

    chrome.storage.local.set(
        { customCrmManifestUrl, c2dDelay, autoLogCountdown, bullhornDefaultActionCode, renderQuickAccessButton, overridingPhoneNumberFormat, overridingPhoneNumberFormat2, overridingPhoneNumberFormat3 },
        () => {
            setupManifest({ customCrmManifestUrl });
        }
    );
};

const clearPlatformInfo = async () => {
    await chrome.storage.local.remove('platform-info')
}

// Restores select box and checkbox state using the preferences
// stored in chrome.storage.
const restoreOptions = () => {
    chrome.storage.local.get(
        { customCrmManifestUrl: '', c2dDelay: '0', bullhornDefaultActionCode: '', renderQuickAccessButton: true, overridingPhoneNumberFormat: '', overridingPhoneNumberFormat2: '', overridingPhoneNumberFormat3: '' },
        (items) => {
            document.getElementById('customCrmManifestUrl').value = items.customCrmManifestUrl;
            document.getElementById('c2dDelay').value = items.c2dDelay;
            document.getElementById('bullhornDefaultActionCode').value = items.bullhornDefaultActionCode;
            document.getElementById('renderQuickAccessButton').checked = items.renderQuickAccessButton;
            document.getElementById('overridingPhoneNumberFormat').value = items.overridingPhoneNumberFormat;
            document.getElementById('overridingPhoneNumberFormat2').value = items.overridingPhoneNumberFormat2;
            document.getElementById('overridingPhoneNumberFormat3').value = items.overridingPhoneNumberFormat3;
        }
    );
};

async function setupManifest({ customCrmManifestUrl }) {
    try {
        await chrome.storage.local.remove('customCrmManifest');
        if (customCrmManifestUrl === '') {
            return;
        }
        const customCrmManifestJson = await (await fetch(customCrmManifestUrl)).json();
        if (customCrmManifestJson) {
            await chrome.storage.local.set({ customCrmManifest: customCrmManifestJson });
        }
        // Update status to let user know options were saved.
        const status = document.getElementById('status');
        status.style = 'color: green';
        status.textContent = 'Options saved.';
    }
    catch (e) {
        clearTimeout(timerId);
        // Update status to let user know options were saved.
        const status = document.getElementById('status');
        status.textContent = 'Manifest file error';
        status.style = 'color: red';
        await chrome.storage.local.remove('customCrmManifest');
    }
}

document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('save').addEventListener('click', saveOptions);
document.getElementById('clear platform info').addEventListener('click', clearPlatformInfo);