// Saves options to chrome.storage
const saveOptions = () => {
    const c2dDelay = document.getElementById('c2dDelay').value;
    const renderQuickAccessButton = document.getElementById('renderQuickAccessButton').checked;
    const trustedParties = document.getElementById('trustedParties').value;
    const allowEmbeddingForAllPages = document.getElementById('allowEmbeddingForAllPages').checked;

    chrome.storage.local.set(
        { c2dDelay, renderQuickAccessButton, trustedParties, allowEmbeddingForAllPages },
        () => {
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
        { c2dDelay: '0', renderQuickAccessButton: true, trustedParties: 'ringcentral', allowEmbeddingForAllPages: false },
        (items) => {
            document.getElementById('c2dDelay').value = items.c2dDelay;
            document.getElementById('renderQuickAccessButton').checked = items.renderQuickAccessButton;
            document.getElementById('allowEmbeddingForAllPages').checked = items.allowEmbeddingForAllPages;
            document.getElementById('trustedParties').value = items.trustedParties;
        }
    );
};

document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('save').addEventListener('click', saveOptions);
document.getElementById('clearPlatformInfo').addEventListener('click', clearPlatformInfo);