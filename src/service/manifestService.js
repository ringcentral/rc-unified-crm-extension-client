import { getPlatformInfo } from './platformService';

async function getManifest() {
    const { customCrmManifest } = await chrome.storage.local.get({ customCrmManifest: null });
    const platformInfo = await getPlatformInfo();
    const override = customCrmManifest?.platforms[platformInfo?.platformName]?.override;
    if (override) {
        for (const overrideItem of override) {
            switch (overrideItem.triggerType) {
                // TEMP: meta should be removed after developer registration is implemented
                case 'meta':
                    for (const overrideObj of overrideItem.overrideObjects) {
                        setValueByPath(customCrmManifest, overrideObj.path, overrideObj.value);
                    }
                    break;
                case 'hostname':
                    if (overrideItem.triggerValue === platformInfo.hostname) {
                        for (const overrideObj of overrideItem.overrideObjects) {
                            setValueByPath(customCrmManifest.platforms[platformInfo.platformName], overrideObj.path, overrideObj.value);
                        }
                    }
                    break;
            }
        }
    }
    return customCrmManifest;
}

function setValueByPath(obj, path, value) {
    // Convert path to an array of keys
    const keys = path.split('.');

    // Get a reference to the object to traverse
    let current = obj;

    // Iterate through the keys, stopping before the last one
    for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];

        // If the current key doesn't exist or is not an object, create an empty object
        if (!current[key] || typeof current[key] !== 'object') {
            current[key] = {};
        }
        // Move to the next level
        current = current[key];
    }

    // Set the value at the final key
    current[keys[keys.length - 1]] = value;
}

exports.getManifest = getManifest;