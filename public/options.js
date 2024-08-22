let timerId = '';

// Saves options to chrome.storage
const saveOptions = () => {
    const customCrmManifestUrl = document.getElementById('customCrmManifestUrl').value;
    const c2dDelay = document.getElementById('c2dDelay').value;
    const renderQuickAccessButton = document.getElementById('renderQuickAccessButton').checked;

    chrome.storage.local.set(
        { customCrmManifestUrl, c2dDelay, renderQuickAccessButton },
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
        { customCrmManifestUrl: '', c2dDelay: '0', renderQuickAccessButton: true },
        (items) => {
            document.getElementById('customCrmManifestUrl').value = items.customCrmManifestUrl;
            document.getElementById('c2dDelay').value = items.c2dDelay;
            document.getElementById('renderQuickAccessButton').checked = items.renderQuickAccessButton;
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