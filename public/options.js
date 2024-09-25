// Saves options to chrome.storage
const saveOptions = () => {
    const c2dDelay = document.getElementById('c2dDelay').value;
    const renderQuickAccessButton = document.getElementById('renderQuickAccessButton').checked;
    const trustedParties = document.getElementById('trustedParties').value;

    chrome.storage.local.set(
        { c2dDelay, renderQuickAccessButton, trustedParties },
        () => {
            fetchManifest({ party: trustedParties });
        }
    );
};

// Restores select box and checkbox state using the preferences
// stored in chrome.storage.
const restoreOptions = () => {
    chrome.storage.local.get(
        { c2dDelay: '0', renderQuickAccessButton: true, trustedParties: 'ringcentral' },
        (items) => {
            document.getElementById('c2dDelay').value = items.c2dDelay;
            document.getElementById('renderQuickAccessButton').checked = items.renderQuickAccessButton;
            document.getElementById('trustedParties').value = items.trustedParties;
        }
    );
};

// fetch manifest for trusted parties
async function fetchManifest({ party }) {
    try {
        let manifest ={};
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

document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('save').addEventListener('click', saveOptions);