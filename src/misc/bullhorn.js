import axios from 'axios';
import { showNotification } from '../lib/util';
import { trackCrmAuthFail } from '../lib/analytics';
import { getServiceManifest } from '../service/embeddableServices';

async function bullhornHeartbeat({ token, manifest, platform, userSettings, crmAuthed, isAdmin, userPermissions }) {
    console.log('checking bullhorn heartbeat...')
    try {
        const response = await axios.get(`${manifest.serverUrl}/authValidation?jwtToken=${token}`);
        if (response.data.successful) {
            console.log('bullhorn heartbeat successful');
        }
        else {
            await chrome.storage.local.remove('rcUnifiedCrmExtJwt');
            const serviceManifest = getServiceManifest({
                platform,
                crmAuthed,
                isAdmin,
                manifest,
                userSettings,
                userPermissions
            });
            document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                type: 'rc-adapter-register-third-party-service',
                service: serviceManifest
            }, '*');
            showNotification({
                level: 'warning',
                message: 'Bullhorn token expired, please reconnect.',
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
                ttl: 120000
            });
            trackCrmAuthFail();
        }
    }
    catch (e) {
        await chrome.storage.local.remove('rcUnifiedCrmExtJwt');
        const serviceManifest = getServiceManifest({
            platform,
            crmAuthed,
            isAdmin,
            manifest,
            userSettings,
            userPermissions
        });
        document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
            type: 'rc-adapter-register-third-party-service',
            service: serviceManifest
        }, '*');
        showNotification({
            level: 'warning',
            message: 'Bullhorn token expired, please reconnect.',
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
            ttl: 120000
        });
        trackCrmAuthFail();
    }
}

exports.bullhornHeartbeat = bullhornHeartbeat;