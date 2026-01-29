import axios from 'axios';
import baseManifest from '../../../manifest.json';
import authCore from '../../../core/auth';
import { showNotification } from '../../../lib/util';
import { refreshUserSettings } from '../../../core/user';
import { getProcessorConfigurePageRender } from '../../../components/processorConfigurePage';

async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
    const { rcUnifiedCrmExtJwt } = await chrome.storage.local.get('rcUnifiedCrmExtJwt');
    switch (data.body.button.id) {
        case 'authButton':
            const getAuthUriResponse = await axios.get(`${data.body.button.formData.processor.authorizationUrl}?jwtToken=${rcUnifiedCrmExtJwt}&processorId=${data.body.button.formData.processorId}`);
            const authUri = getAuthUriResponse.data;
            authCore.handleThirdPartyOAuthWindow(authUri);
            break;
        case 'logoutButton':
            const logoutResponse = await axios.post(`${data.body.button.formData.processor.logoutUrl}?jwtToken=${rcUnifiedCrmExtJwt}`);
            if (logoutResponse.data.successful) {
                showNotification({ level: 'success', message: 'Successfully logged out.', ttl: 3000 });
                const processor = data.body.button.formData.processor;
                const changedSettings = {
                    [`processor_${processor.id}`]: {
                        value: {
                            name: processor.name,
                            version: processor.version,
                            activated: false,
                            supportedLogType: processor.supportedLogType,
                            isAsync: processor.isAsync,
                            phase: processor.phase,
                        }
                    }
                }
                const userSettings = await refreshUserSettings({ changedSettings });
                const processorSetting = userSettings?.[`processor_${processor.id}`];
                const activated = processorSetting?.value?.activated ?? false;
                const processorAccess = processorSetting?.value?.access;
                const selectedLogTypes = processorSetting?.value?.supportedLogType ?? '';
                const processorConfigurePageRender = getProcessorConfigurePageRender({ processorId: processor.id, processorAccess, processor, activated, selectedLogTypes, isLoggedIn: false });
                document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-register-customized-page',
                    page: processorConfigurePageRender
                });
                document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-navigate-to',
                    path: `/customized/${processorConfigurePageRender.id}`
                }, '*');
            }
            else {
                showNotification({ level: 'error', message: 'Failed to log out.', ttl: 3000 });
            }
            break;
    }
    window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
}

exports.onEvent = onEvent;