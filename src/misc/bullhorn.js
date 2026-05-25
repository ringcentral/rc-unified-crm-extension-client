import axios from 'axios';
import { showNotification } from '../lib/util';
import { trackCrmAuthFail } from '../lib/analytics';
import { getServiceManifest } from '../service/embeddableServices';
import { getManifest } from '../service/manifestService';
import calldownPage from '../components/calldownPage';
import userCore from '../core/user';

async function bullhornHeartbeat({ platform }) {
    console.log('checking bullhorn heartbeat...')
    const manifest = await getManifest();
    const { rcUnifiedCrmExtJwt: token } = await chrome.storage.local.get('rcUnifiedCrmExtJwt');
    try {
        const response = await axios.get(`${manifest.serverUrl}/authValidation`);
        if (response.data.successful) {
            console.log('bullhorn heartbeat successful');
        }
        else {
            await chrome.storage.local.remove('rcUnifiedCrmExtJwt');
            await chrome.storage.local.remove('crmAuthed');

            // Clear call back page after CRM disconnect
            try {
                const { userSettings } = await chrome.storage.local.get({ userSettings: {} });
                if (userCore.getShowCalldownTabSetting(userSettings).value) {
                    const emptyCalldownPage = calldownPage.getCalldownPageRender();
                    emptyCalldownPage.hidden = true; // Hide the tab when CRM is disconnected
                    emptyCalldownPage.unreadCount = 0;
                    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                        type: 'rc-adapter-register-customized-page',
                        page: emptyCalldownPage
                    }, '*');
                }
            } catch (e) { /* ignore */ }

            const serviceManifest = await getServiceManifest();
            document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                type: 'rc-adapter-register-third-party-service',
                service: serviceManifest
            }, '*');
            showNotification({
                level: 'warning',
                message: 'Bullhorn token expired. Auto-reconnecting to Bullhorn...',
                ttl: 3000
            });
            showNotification({
                level: 'warning',
                message: 'If auto connect failed, please reconnect manually.',
                details: [{
                    title: 'Steps to reconnect',
                    items: [
                        {
                            id: '1',
                            type: 'text',
                            text: '1. In user settings, click Logout.'
                        },
                        {
                            id: '2',
                            type: 'text',
                            text: '2. Refresh Bullhorn page.'
                        },
                        {
                            id: '3',
                            type: 'text',
                            text: '3. Reload the extension and Connect to Bullhorn again.'
                        }
                    ]
                }],
                ttl: 10000
            });
            trackCrmAuthFail();
            await tryConnectToBullhorn({ platform });
        }
    }
    catch (e) {
        await chrome.storage.local.remove('rcUnifiedCrmExtJwt');
        await chrome.storage.local.remove('crmAuthed');

        // Clear call back page after CRM disconnect
        try {
            const { userSettings } = await chrome.storage.local.get({ userSettings: {} });
            if (userCore.getShowCalldownTabSetting(userSettings).value) {
                const emptyCalldownPage = calldownPage.getCalldownPageRender();
                emptyCalldownPage.hidden = true; // Hide the tab when CRM is disconnected
                emptyCalldownPage.unreadCount = 0;
                document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-register-customized-page',
                    page: emptyCalldownPage
                }, '*');
            }
        } catch (e2) { /* ignore */ }

        const serviceManifest = await getServiceManifest();
        document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
            type: 'rc-adapter-register-third-party-service',
            service: serviceManifest
        }, '*');
        showNotification({
            level: 'warning',
            message: 'Bullhorn token expired. Auto-reconnecting to Bullhorn...',
            details: [{
                title: 'Steps to reconnect',
            }],
            ttl: 3000
        });
        showNotification({
            level: 'warning',
            message: 'If auto connect failed, please reconnect manually.',
            details: [{
                title: 'Steps to reconnect',
                items: [
                    {
                        id: '1',
                        type: 'text',
                        text: '1. In user settings, click Logout.'
                    },
                    {
                        id: '2',
                        type: 'text',
                        text: '2. Refresh Bullhorn page.'
                    },
                    {
                        id: '3',
                        type: 'text',
                        text: '3. Reload the extension and Connect to Bullhorn again.'
                    }
                ]
            }],
            ttl: 10000
        });
        trackCrmAuthFail();
        showNotification({
            level: 'warning',
            message: 'Auto-reconnecting to Bullhorn...',
            details: [{
                title: 'Steps to reconnect',
            }],
            ttl: 3000
        });
        await tryConnectToBullhorn({ platform });
    }
}

async function tryConnectToBullhorn({ platform }) {
    let authUri = null;
    let { crm_extension_bullhorn_user_urls } = await chrome.storage.local.get({ crm_extension_bullhorn_user_urls: null });
    if (crm_extension_bullhorn_user_urls?.oauthUrl) {
        authUri = `${crm_extension_bullhorn_user_urls.oauthUrl}/authorize?` +
            `response_type=code` +
            `&action=Login` +
            `&client_id=${platform.auth.oauth.clientId}` +
            `&state=platform=${platform.name}` +
            '&redirect_uri=https://apps.ringcentral.com/integration/ringcentral-embeddable/latest/redirect.html';
    }
    else {
        const { crm_extension_bullhornUsername } = await chrome.storage.local.get({ crm_extension_bullhornUsername: null });
        showNotification({
            level: 'warning',
            message: 'Login failure. If you already have Bullhorn page open, please refresh Bullhorn page and try again.',
            details: [
                {
                    title: 'Details',
                    items: [
                        {
                            id: '1',
                            type: 'text',
                            text: `To connect to Bullhorn successfully, please open up the Bullhorn app and reload the page in your browser. Then click the "Connect" button again.`
                        }
                    ]
                }
            ],
            ttl: 30000
        });
        const { data: crm_extension_bullhorn_user_urls } = await axios.get(`https://rest.bullhornstaffing.com/rest-services/loginInfo?username=${crm_extension_bullhornUsername}`);
        await chrome.storage.local.set({ crm_extension_bullhorn_user_urls });
        if (crm_extension_bullhorn_user_urls?.oauthUrl) {
            authUri = `${crm_extension_bullhorn_user_urls.oauthUrl}/authorize?` +
                `response_type=code` +
                `&action=Login` +
                `&client_id=${platform.auth.oauth.clientId}` +
                `&state=platform=${platform.name}` +
                '&redirect_uri=https://apps.ringcentral.com/integration/ringcentral-embeddable/latest/redirect.html';
        }
    }
    chrome.runtime.sendMessage({
        type: 'openThirdPartyAuthWindow',
        oAuthUri: authUri
    });
}

exports.bullhornHeartbeat = bullhornHeartbeat;
exports.tryConnectToBullhorn = tryConnectToBullhorn;