import axios from 'axios';
import baseManifest from '../../../manifest.json';
import authCore from '../../../core/auth';
async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
    const { rcUnifiedCrmExtJwt } = await chrome.storage.local.get('rcUnifiedCrmExtJwt');
    // TEMP: changed to get auth uri endpoint from Dev Console profile
    const getAuthUriResponse = await axios.get(`${manifest.serverUrl}/googleDrive/oauthUrl?jwtToken=${rcUnifiedCrmExtJwt}`);
    const authUri = getAuthUriResponse.data;
    authCore.handleThirdPartyOAuthWindow(authUri);
}

exports.onEvent = onEvent;