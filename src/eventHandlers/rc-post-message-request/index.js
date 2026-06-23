import { getManifest } from '../../service/manifestService';
import { getPlatformInfo } from '../../service/platformService';
import { getPlatformList } from '../../service/manifestService';
import { showNotification, responseMessage } from '../../lib/util';

import authorizeHandler from './authorize';
import customizedPageInputChangedHandler from './customizedPage/inputChanged';
import contactsMatchHandler from './contacts/match';
import contactsViewHandler from './contacts/view';
import callLoggerIndexHandler from './callLogger';
import callLoggerInputChangedHandler from './callLogger/inputChanged';
import callLoggerMatchHandler from './callLogger/match';
import messageLoggerIndexHandler from './messageLogger';
import messageLoggerInputChangedHandler from './messageLogger/inputChanged';
import messageLoggerMatchHandler from './messageLogger/match';
import settingsHandler from './settings';
import customButtonClickHandler from './custom-button-click';
import authCore from '../../core/auth';

async function onEvent({ data }) {
  const crmAuthed = await authCore.syncCrmAuthedFromStorage();
  const manifest = await getManifest();
  const platformInfo = await getPlatformInfo();
  const platformName = platformInfo?.platformName ?? '';;
  const platform = manifest?.platforms[platformName];
  if (!crmAuthed && (data.path === '/callLogger' || data.path === '/messageLogger')) {
    showNotification({ level: 'warning', message: `Please go to user settings page and connect to your ${manifest.platforms[platformName].displayName} account.`, ttl: 60000 });
    responseMessage(data.requestId, { data: 'ok' });
    return;
  }
  switch (data.path) {
    case '/authorize':
      await authorizeHandler.onEvent({ data, manifest, platformInfo, platformName, platform });
      break;
    case '/platform-selection':
      window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
      const platformList = await getPlatformList();
      await authCore.checkAndOpenPlatformSelectionPage({ platformList });
      window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
      break;
    case '/customizedPage/inputChanged':
      await customizedPageInputChangedHandler.onEvent({ data, manifest, platformInfo, platformName, platform });
      break;
    case '/contacts/match':
      await contactsMatchHandler.onEvent({ data, manifest, platformInfo, platformName, platform });
      break;
    case '/contacts/view':
      await contactsViewHandler.onEvent({ data, manifest, platformInfo, platformName, platform });
      break;
    case '/callLogger':
      await callLoggerIndexHandler.onEvent({ data, manifest, platformInfo, platformName, platform });
      break;
    case '/callLogger/inputChanged':
      await callLoggerInputChangedHandler.onEvent({ data, manifest, platformInfo, platformName, platform });
      break;
    case '/callLogger/match':
      await callLoggerMatchHandler.onEvent({ data, manifest, platformInfo, platformName, platform });
      break;
    case '/messageLogger':
      await messageLoggerIndexHandler.onEvent({ data, manifest, platformInfo, platformName, platform });
      break;
    case '/messageLogger/inputChanged':
      await messageLoggerInputChangedHandler.onEvent({ data, manifest, platformInfo, platformName, platform });
      break;
    case '/messageLogger/match':
      await messageLoggerMatchHandler.onEvent({ data, manifest, platformInfo, platformName, platform });
      break;
    case '/settings':
      await settingsHandler.onEvent({ data, manifest, platformInfo, platformName, platform });
      break;
    case '/custom-button-click':
      await customButtonClickHandler.onEvent({ data, manifest, platformInfo, platformName, platform });
      break;
    default:
      responseMessage(data.requestId, { data: 'ok' });
      break;
  }
}

exports.onEvent = onEvent;