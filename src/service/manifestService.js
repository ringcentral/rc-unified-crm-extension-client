import { getPlatformInfo } from './platformService';
import axios from 'axios';
import baseManifest from '../manifest.json';
import { getRcInfo } from '../lib/util';

async function getPlatformList() {
    const result = [];
    const platformPublicListResponse = await axios.get(baseManifest.platformPublicListUrl);
    for (const platform of platformPublicListResponse.data.connectors) {
        platform.type = 'public';
        result.push(platform);
    }
    const rcInfo = await getRcInfo();
    const rcAccountId = rcInfo.value.cachedData.accountInfo.id;
    const platformInternalListResponse = await axios.get(`${baseManifest.platformInternalListUrl}?accountId=${rcAccountId}`);
    for (const platform of platformInternalListResponse.data.sharedConnectors) {
        platform.type = 'shared';
        result.push(platform);
    }
    for (const platform of platformInternalListResponse.data.privateConnectors) {
        platform.type = 'private';
        result.push(platform);
    }
    return result;
}

async function saveManifestUrl({ manifestUrl }) {
    await chrome.storage.local.set({ manifestUrl: manifestUrl });
    return manifestUrl;
}

async function saveManifest({ manifest }) {
    await chrome.storage.local.set({ customCrmManifest: manifest });
    return manifest;
}

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
exports.getPlatformList = getPlatformList;
exports.saveManifest = saveManifest;
exports.saveManifestUrl = saveManifestUrl;