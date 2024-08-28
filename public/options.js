let timerId = '';

// Saves options to chrome.storage
const saveOptions = () => {
    const c2dDelay = document.getElementById('c2dDelay').value;
    const renderQuickAccessButton = document.getElementById('renderQuickAccessButton').checked;

    chrome.storage.local.set(
        { c2dDelay, renderQuickAccessButton },
        () => {
        }
    );
};

// Restores select box and checkbox state using the preferences
// stored in chrome.storage.
const restoreOptions = () => {
    chrome.storage.local.get(
        { c2dDelay: '0', renderQuickAccessButton: true },
        (items) => {
            document.getElementById('c2dDelay').value = items.c2dDelay;
            document.getElementById('renderQuickAccessButton').checked = items.renderQuickAccessButton;
        }
    );
};

document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('save').addEventListener('click', saveOptions);