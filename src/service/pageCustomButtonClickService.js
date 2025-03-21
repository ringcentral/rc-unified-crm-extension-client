import { showNotification, getRcAccessToken } from '../lib/util';
import axios from 'axios';

async function onCustomPageButtonPress({ data }) {
    const { customManifest: manifest } = await chrome.storage.local.get({ customManifest: null });
    switch (data.body.button.id) {
        case 'callAndSMSLoggingSettingPage':
        case 'contactSettingPage':
        case 'advancedFeaturesSettingPage':
        case 'customSettingsPage':
            window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
            const settingDataKeys = Object.keys(data.body.button.formData);
            for (const k of settingDataKeys) {
                adminSettings.userSettings[k] = data.body.button.formData[k];
            }
            await chrome.storage.local.set({ adminSettings });
            const rcAccessToken = getRcAccessToken();
            await uploadAdminSettings({ serverUrl: manifest.serverUrl, adminSettings, rcAccessToken });
            await refreshUserSettings();
            showNotification({ level: 'success', message: `Settings saved.`, ttl: 3000 });
            window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
            break;
        case 'insightlyGetApiKey':
            const platformInfo = await chrome.storage.local.get('platform-info');
            const hostname = platformInfo['platform-info'].hostname;
            window.open(`https://${hostname}/Users/UserSettings`);
            break;
        case 'authPage':
            window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
            const returnedToken = await auth.apiKeyLogin({ serverUrl: manifest.serverUrl, apiKey: data.body.button.formData.apiKey, formData: data.body.button.formData });
            const { crmAuthed } = await chrome.storage.local.get({ crmAuthed: false });
            if (crmAuthed) {
                const adminSettingResults = await refreshAdminSettings();
                adminSettings = adminSettingResults.adminSettings;
                await refreshUserSettings();
                const adminPageRender = adminPage.getAdminPageRender({ platform });
                document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-register-customized-page',
                    page: adminPageRender,
                }, '*');
            }
            window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
            break;
        case 'feedbackPage':
            // const platformNameInUrl = platformName.charAt(0).toUpperCase() + platformName.slice(1)
            let formUrl = manifest.platforms[platformName].page.feedback.url
            for (const formKey of Object.keys(data.body.button.formData)) {
                formUrl = formUrl.replace(`{${formKey}}`, encodeURIComponent(data.body.button.formData[formKey]));
            }
            formUrl = formUrl
                .replace('{crmName}', manifest.platforms[platformName].displayName)
                .replace('{userName}', rcUserInfo.rcUserName)
                .replace('{userEmail}', rcUserInfo.rcUserEmail)
                .replace('{version}', manifest.version)
            window.open(formUrl, '_blank');
            document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                type: 'rc-adapter-navigate-to',
                path: 'goBack',
            }, '*');
            break;
        case 'openSupportPage':
            let isOnline = false;
            try {
                const isServiceOnlineResponse = await axios.get(`${manifest.serverUrl}/is-alive`);
                isOnline = isServiceOnlineResponse.status === 200;
            }
            catch (e) {
                isOnline = false;
            }
            const supportPageRender = supportPage.getSupportPageRender({ manifest, isOnline });
            document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                type: 'rc-adapter-register-customized-page',
                page: supportPageRender
            });
            document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                type: 'rc-adapter-navigate-to',
                path: '/customized/supportPage', // page id
            }, '*');
            break;
        case 'openAboutPage':
            const aboutPageRender = aboutPage.getAboutPageRender({ manifest });
            document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                type: 'rc-adapter-register-customized-page',
                page: aboutPageRender
            });
            document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                type: 'rc-adapter-navigate-to',
                path: '/customized/aboutPage', // page id
            }, '*');
            break;
        case 'openDeveloperSettingsPage':
            const { customCrmManifestUrl } = await chrome.storage.local.get({ customCrmManifestUrl: '' });
            const developerSettingsPageRender = developerSettingsPage.getDeveloperSettingsPageRender({ customUrl: customCrmManifestUrl });
            document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                type: 'rc-adapter-register-customized-page',
                page: developerSettingsPageRender
            });
            document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                type: 'rc-adapter-navigate-to',
                path: '/customized/developerSettingsPage', // page id
            }, '*');
            break;
        case 'factoryResetButton':
            document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                type: 'rc-adapter-navigate-to',
                path: 'goBack',
            }, '*');
            window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
            const { rcUnifiedCrmExtJwt } = await chrome.storage.local.get('rcUnifiedCrmExtJwt');
            if (rcUnifiedCrmExtJwt) {
                await auth.unAuthorize({ serverUrl: manifest.serverUrl, platformName, rcUnifiedCrmExtJwt });
            }
            await chrome.storage.local.remove('platform-info');
            document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                type: 'rc-adapter-logout'
            }, '*');
            window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
            trackFactoryReset();
            break;
        case 'generateErrorLogButton':
            const errorLogFileName = "[RingCentral App Connect]ErrorLogs.txt";
            const errorLogFileContent = JSON.stringify(errorLogs);
            downloadTextFile({ filename: errorLogFileName, text: errorLogFileContent });
            break;
        case 'checkForUpdateButton':
            const registeredVersionInfo = await chrome.storage.local.get('rc-crm-extension-version');
            const localVersion = registeredVersionInfo['rc-crm-extension-version'];
            const onlineVerison = manifest.version;
            if (localVersion === onlineVerison) {
                showNotification({ level: 'success', message: `You are using the latest version (${localVersion})`, ttl: 5000 });
            }
            else {
                showNotification({ level: 'warning', message: `New version (${onlineVerison}) is available, please go to chrome://extensions and press "Update"`, ttl: 5000 });
            }
            break;
        case 'openFeedbackPageButton':
            chrome.runtime.sendMessage({
                type: "openPopupWindow",
                navigationPath: "/feedback"
            });
            break;
        case 'documentation':
            if (platform?.documentationUrl) {
                window.open(platform.documentationUrl);
                trackPage('/documentation');
            }
            else {
                showNotification({ level: 'warning', message: 'Documentation URL is not set', ttl: 3000 });
            }
            break;
        case 'releaseNotes':
            if (platform?.releaseNotesUrl) {
                window.open(platform.releaseNotesUrl);
                trackPage('/releaseNotes');
            }
            else {
                showNotification({ level: 'warning', message: 'Release notes URL is not set', ttl: 3000 });
            }
            break;
        case 'getSupport':
            if (platform?.getSupportUrl) {
                window.open(platform.getSupportUrl);
                trackPage('/getSupport');
            }
            else {
                showNotification({ level: 'warning', message: 'Get support URL is not set', ttl: 3000 });
            }
            break;
        case 'writeReview':
            if (platform?.writeReviewUrl) {
                window.open(platform.writeReviewUrl);
                trackPage('/writeReview');
            }
            else {
                showNotification({ level: 'warning', message: 'Write review URL is not set', ttl: 3000 });
            }
            break;
        case 'saveAdminAdapterButton':
            const customCrmManifestJson = await (await fetch(data.body.button.formData.customManifestUrl)).json();
            if (customCrmManifestJson) {
                adminSettings.customAdapter = {
                    url: data.body.button.formData.customManifestUrl,
                }
                await chrome.storage.local.set({ adminSettings });
                await uploadAdminSettings({ serverUrl: manifest.serverUrl, adminSettings, rcAccessToken: getRcAccessToken() });
                await refreshUserSettings();
                showNotification({ level: 'success', message: 'Custom manifest file uploaded.', ttl: 5000 });
            }
            break;
        case 'saveServerSideLoggingButton':
            window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
            adminSettings.userSettings.serverSideLogging =
            {
                enable: data.body.button.formData.serverSideLogging != 'Disable',
                doNotLogNumbers: data.body.button.formData.doNotLogNumbers,
                loggingLevel: data.body.button.formData.serverSideLogging
            };
            await refreshUserSettings({
                changedSettings: {
                    serverSideLogging:
                    {
                        enable: data.body.button.formData.serverSideLogging != 'Disable',
                        doNotLogNumbers: data.body.button.formData.doNotLogNumbers,
                        loggingLevel: data.body.button.formData.serverSideLogging
                    }
                }
            });
            await chrome.storage.local.set({ adminSettings });
            await uploadAdminSettings({ serverUrl: manifest.serverUrl, adminSettings, rcAccessToken: getRcAccessToken() });
            if (data.body.button.formData.serverSideLogging != 'Disable') {
                await enableServerSideLogging({ platform, rcAccessToken: getRcAccessToken(), subscriptionLevel: data.body.button.formData.serverSideLogging });
                showNotification({ level: 'success', message: 'Server side logging turned ON. Auto call log inside the extension will be forced OFF.', ttl: 5000 });
            }
            else {
                await disableServerSideLogging({ platform, rcAccessToken: getRcAccessToken() });
                showNotification({ level: 'success', message: 'Server side logging turned OFF.', ttl: 5000 });
            }
            document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                type: 'rc-adapter-register-third-party-service',
                service: (await getServiceManifest())
            }, '*');
            await updateServerSideDoNotLogNumbers({ platform, rcAccessToken: getRcAccessToken(), doNotLogNumbers: data.body.button.formData.doNotLogNumbers ?? "" });
            showNotification({ level: 'success', message: 'Server side logging do not log numbers updated.', ttl: 5000 });
            window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
            document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                type: 'rc-adapter-navigate-to',
                path: 'goBack',
            }, '*');
            break;
        case 'developerSettingsPage':
            try {
                const customManifestUrl = data.body.button.formData.customManifestUrl;
                if (customManifestUrl === '') {
                    return;
                }
                await chrome.storage.local.set({ customCrmManifestUrl: customManifestUrl });

                await chrome.storage.local.remove('customCrmManifest');
                const customCrmManifestJson = await (await fetch(customManifestUrl)).json();
                if (customCrmManifestJson) {
                    await chrome.storage.local.set({ customCrmManifest: customCrmManifestJson });
                    showNotification({ level: 'success', message: 'Custom manifest file updated. Please reload the extension.', ttl: 5000 });
                    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                        type: 'rc-adapter-navigate-to',
                        path: 'goBack',
                    }, '*');
                }
            }
            catch (e) {
                showNotification({ level: 'warning', message: 'Failed to get custom manifest file', ttl: 5000 });
            }
            break;
        case 'clearPlatformInfoButton':
            await chrome.storage.local.remove('platform-info');
            showNotification({ level: 'success', message: 'Platform info cleared. Please close the extension and open from CRM page.', ttl: 5000 });
            break;
    }
}

exports.onCustomPageButtonPress = onCustomPageButtonPress;