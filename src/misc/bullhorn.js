import axios from 'axios';
import { showNotification, getManifest } from '../lib/util';
import { trackCrmAuthFail } from '../lib/analytics';
import { getServiceManifest } from '../service/embeddableServices';

async function bullhornHeartbeat() {
    console.log('checking bullhorn heartbeat...')
    const manifest = await getManifest();
    const { rcUnifiedCrmExtJwt: token } = await chrome.storage.local.get('rcUnifiedCrmExtJwt');
    try {
        const response = await axios.get(`${manifest.serverUrl}/authValidation?jwtToken=${token}`);
        if (response.data.successful) {
            console.log('bullhorn heartbeat successful');
        }
        else {
            await chrome.storage.local.remove('rcUnifiedCrmExtJwt');
            const serviceManifest = getServiceManifest();
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
        const serviceManifest = getServiceManifest();
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