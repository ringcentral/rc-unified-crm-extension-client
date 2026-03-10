import { getPlatformInfo } from './platformService';
import axios from 'axios';
import baseManifest from '../manifest.json';
import { getRcInfo } from '../lib/util';

let sessionManifest = null;
let platformList = null;

async function getPluginDetails({ pluginId, selectedPlugin }) {
    let pluginManifestResponse;
    switch (selectedPlugin.access) {
        case 'public':
            pluginManifestResponse = await axios.get(`${baseManifest.platformPublicListUrl}/${pluginId ?? selectedPlugin.id}/manifest?type=plugin`);
            break;
        case 'shared':
            pluginManifestResponse = await axios.get(`${baseManifest.platformPublicListUrl}/${pluginId ?? selectedPlugin.id}/manifest?access=internal&type=plugin&accountId=${selectedPlugin.accountId}`);
            break;
        case 'private':
            const rcInfo = await getRcInfo();
            pluginManifestResponse = await axios.get(`${baseManifest.platformPublicListUrl}/${pluginId ?? selectedPlugin.id}/manifest?access=internal&type=plugin&accountId=${rcInfo.value.cachedData.accountInfo.id}`);
            break;
    }
    return pluginManifestResponse.data?.platforms?.[selectedPlugin.name];
}

async function getPlatformList() {
    if (platformList) {
        return platformList;
    }
    const result = [];
    const platformPublicListResponse = await axios.get(`${baseManifest.platformPublicListUrl}?type=connector`);
    for (const platform of platformPublicListResponse.data.connectors) {
        platform.access = 'public';
        result.push(platform);
    }
    const rcInfo = await getRcInfo();
    const rcAccountId = rcInfo.value.cachedData.accountInfo.id;
    const platformInternalListResponse = await axios.get(`${baseManifest.platformInternalListUrl}?access=internal&type=connector&accountId=${rcAccountId}`);
    for (const platform of platformInternalListResponse.data.sharedConnectors) {
        platform.access = 'shared';
        result.push(platform);
    }
    for (const platform of platformInternalListResponse.data.privateConnectors) {
        platform.access = 'private';
        result.push(platform);
    }
    platformList = result;
    return platformList;
}

async function getPluginList() {
    const result = [];
    const pluginPublicListResponse = await axios.get(`${baseManifest.platformPublicListUrl}?type=plugin`);
    for (const plugin of pluginPublicListResponse.data.connectors) {
        plugin.access = 'public';
        result.push(plugin);
    }
    const rcInfo = await getRcInfo();
    const rcAccountId = rcInfo.value.cachedData.accountInfo.id;
    const pluginInternalListResponse = await axios.get(`${baseManifest.platformInternalListUrl}?access=internal&type=plugin&accountId=${rcAccountId}`);
    for (const plugin of pluginInternalListResponse.data.sharedConnectors) {
        plugin.access = 'shared';
        result.push(plugin);
    }
    for (const plugin of pluginInternalListResponse.data.privateConnectors) {
        plugin.access = 'private';
        result.push(plugin);
    }
    return result;
}

async function saveManifestUrl({ manifestUrl }) {
    await chrome.storage.local.set({ manifestUrl: manifestUrl });
    return manifestUrl;
}

async function saveManifest({ manifest }) {
    sessionManifest = manifest;
    const platformInfo = await getPlatformInfo();
    const override = sessionManifest?.platforms[platformInfo?.platformName]?.override;
    if (override) {
        for (const overrideItem of override) {
            switch (overrideItem.triggerType) {
                // TEMP: meta should be removed after developer registration is implemented
                case 'meta':
                    for (const overrideObj of overrideItem.overrideObjects) {
                        setValueByPath(sessionManifest, overrideObj.path, overrideObj.value);
                    }
                    break;
                case 'hostname':
                    if (overrideItem.triggerValue === platformInfo.hostname) {
                        for (const overrideObj of overrideItem.overrideObjects) {
                            setValueByPath(sessionManifest.platforms[platformInfo.platformName], overrideObj.path, overrideObj.value);
                        }
                    }
                    break;
            }
        }
    }
    await chrome.storage.local.set({ customCrmManifest: sessionManifest });
    return sessionManifest;
}

async function refreshManifest() {
    let { manifestUrl } = await chrome.storage.local.get({ manifestUrl: null });
    if (!manifestUrl) {
        const { customCrmManifest } = await chrome.storage.local.get({ customCrmManifest: null });
        if (!customCrmManifest) {
            return null;
        }
        else {
            manifestUrl = customCrmManifest;
            await saveManifestUrl({ manifestUrl });
            await chrome.storage.local.remove('customCrmManifest');
        }
    }
    const manifestResponse = await axios.get(manifestUrl);
    const manifest = manifestResponse.data;
    await saveManifest({ manifest });
    return manifest;
}

async function getManifest(forceRefresh = false) {
    if (sessionManifest && !forceRefresh) {
        return sessionManifest;
    }
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

exports.getPluginDetails = getPluginDetails;
exports.getManifest = getManifest;
exports.getPlatformList = getPlatformList;
exports.getPluginList = getPluginList;
exports.saveManifest = saveManifest;
exports.saveManifestUrl = saveManifestUrl;
exports.refreshManifest = refreshManifest;