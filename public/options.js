// Saves options to chrome.storage
const saveOptions = () => {
    const customCrmManifestUrl = document.getElementById('customCrmManifestUrl').value;
    const c2dDelay = document.getElementById('c2dDelay').value;
    const renderQuickAccessButton = document.getElementById('renderQuickAccessButton').checked;
    const trustedParties = document.getElementById('trustedParties').value;
    const allowEmbeddingForAllPages = document.getElementById('allowEmbeddingForAllPages').checked;

    chrome.storage.local.set(
        { customCrmManifestUrl, c2dDelay, renderQuickAccessButton, trustedParties, allowEmbeddingForAllPages },
        () => {
            if (customCrmManifestUrl != '') {
                setupConfig({ customCrmManifestUrl });
            }
            else {
                fetchManifest({ party: trustedParties });
            }
        }
    );
};

const clearPlatformInfo = async () => {
    await chrome.storage.local.remove('platform-info')
    const status = document.getElementById('status');
    status.style = 'color: green';
    status.textContent = `Platform info cleared`;
}

// Restores select box and checkbox state using the preferences
// stored in chrome.storage.
const restoreOptions = () => {
    chrome.storage.local.get(
        { customCrmManifestUrl: '', c2dDelay: '0', renderQuickAccessButton: true, trustedParties: 'ringcentral', allowEmbeddingForAllPages: false },
        (items) => {
            document.getElementById('customCrmManifestUrl').value = items.customCrmManifestUrl;
            document.getElementById('c2dDelay').value = items.c2dDelay;
            document.getElementById('renderQuickAccessButton').checked = items.renderQuickAccessButton;
            document.getElementById('allowEmbeddingForAllPages').checked = items.allowEmbeddingForAllPages;
            document.getElementById('trustedParties').value = items.trustedParties;
        }
    );
};

// fetch manifest for trusted parties
async function fetchManifest({ party }) {
    try {
        let manifest = {};
        switch (party) {
            case 'ringcentral':
                manifest = await fetch('https://unified-crm-extension.labs.ringcentral.com/crmManifest').then(res => res.json());
                await chrome.storage.local.set({ customCrmManifestUrl: 'https://unified-crm-extension.labs.ringcentral.com/crmManifest' });
                break;
            case 'gate6':
                manifest = await fetch('https://rcservicenowapi.gate6.com/crmManifest?platformName=servicenow').then(res => res.json());
                await chrome.storage.local.set({ customCrmManifestUrl: 'https://rcservicenowapi.gate6.com/crmManifest?platformName=servicenow' });
                break;
        }
        await chrome.storage.local.set({ customCrmManifest: manifest });
        // Update status to let user know options were saved.
        const status = document.getElementById('status');
        status.style = 'color: green';
        status.textContent = `Saved as ${manifest.author.name}`;
    }
    catch (e) {
        // Update status to let user know options were saved.
        const status = document.getElementById('status');
        status.textContent = 'Config file error';
        status.style = 'color: red';
        await chrome.storage.local.remove('customCrmConfig');
    }
}

async function setupConfig({ customCrmManifestUrl }) {
    try {
        const customCrmConfigJson = await (await fetch(customCrmManifestUrl)).json();
        if (customCrmConfigJson) {
            await chrome.storage.local.set({ customCrmManifestUrl });
        }
        // Update status to let user know options were saved.
        const status = document.getElementById('status');
        status.style = 'color: green';
        status.textContent = 'Options saved.';
    }
    catch (e) {
        // Update status to let user know options were saved.
        const status = document.getElementById('status');
        status.textContent = 'Config file error';
        status.style = 'color: red';
        await chrome.storage.local.remove('customCrmConfig');
    }
}

document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('save').addEventListener('click', saveOptions);
document.getElementById('clearPlatformInfo').addEventListener('click', clearPlatformInfo);