import { openDB } from 'idb';
import { trackCRMSetupError } from '../lib/analytics';
import crmSetupErrorPage from '../components/crmSetupErrorPage';

function secondsToHourMinuteSecondString(totalSeconds) {
  const hours = parseInt(totalSeconds / 3600);
  const minutes = parseInt((totalSeconds - 3600 * hours) / 60);
  const seconds = parseInt(totalSeconds - 3600 * hours - 60 * minutes);
  return `${hours}h${minutes}m${seconds}s`;
}

async function showNotification({ level, message, ttl, details = null }) {
  if (!level || !message || isObjectEmpty(message)) {
    return;
  }
  const notificationId = await RCAdapter.alertMessage({ message, ttl, level, details });
  return notificationId;
}

async function dismissNotification({ notificationId }) {
  if (notificationId) {
    await RCAdapter.dismissMessage(notificationId);
  }
}

function responseMessage(responseId, response) {
  document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
    type: 'rc-post-message-response',
    responseId,
    response,
  }, '*');
}

function isObjectEmpty(obj) {
  return Object.keys(obj).length === 0 && obj.constructor === Object;
}

async function getRcInfo() {
  const extId = JSON.parse(localStorage.getItem('sdk-rc-widgetplatform')).owner_id;
  const indexDB = await openDB(`rc-widget-storage-${extId}`, 2);
  const rcInfo = await indexDB.get('keyvaluepairs', 'dataFetcherV2-storageData');
  return rcInfo;
}

function getRcAccessToken() {
  return JSON.parse(localStorage.getItem('sdk-rc-widgetplatform')).access_token;
}

async function getPlatformInfo() {
  const platformInfo = await chrome.storage.local.get('platform-info');
  if (isObjectEmpty(platformInfo)) {
    renderCRMSetupErrorPage();
    return null;
  }
  return platformInfo['platform-info'];
}

function renderCRMSetupErrorPage() {
  const crmSetupErrorPageRender = crmSetupErrorPage.getCRMSetupErrorPageRender();
  document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
    type: 'rc-adapter-register-customized-page',
    page: crmSetupErrorPageRender
  });
  document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
    type: 'rc-adapter-navigate-to',
    path: '/customized/crmSetupErrorPage', // page id
  }, '*');
  trackCRMSetupError();
}

async function checkC2DCollision() {
  try {
    const { rcForGoogleCollisionChecked } = await chrome.storage.local.get({ rcForGoogleCollisionChecked: false });
    const collidingC2DResponse = await fetch("chrome-extension://fddhonoimfhgiopglkiokmofecgdiedb/redirect.html");
    if (!rcForGoogleCollisionChecked && collidingC2DResponse.status === 200) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: '/images/logo32.png',
        title: `Click-to-dial may not work`,
        message: "The RingCentral for Google Chrome extension has been detected. You may wish to customize your click-to-dial preferences for your desired behavior",
        priority: 1,
        buttons: [
          {
            title: 'Configure'
          }
        ]
      });
      chrome.notifications.onButtonClicked.addListener(
        (notificationId, buttonIndex) => {
          window.open('https://youtu.be/tbCOM27GUbc');
        }
      )

      await chrome.storage.local.set({ rcForGoogleCollisionChecked: true });
    }
  }
  catch (e) {
    //ignore
  }
}

function downloadTextFile({ filename, text }) {
  var element = document.createElement('a');
  element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
  element.setAttribute('download', filename);

  element.style.display = 'none';
  document.body.appendChild(element);

  element.click();

  document.body.removeChild(element);
}

function cleanUpExpiredStorage(){
  chrome.storage.local.get(null, function(items) {
    // 'items' is an object containing all key-value pairs
    // stored in chrome.storage.local.
    console.log("Start cleaning expired items");
    const keysToBeDeleted = [];
    // You can now process the 'items' object
    for (let key in items) {
      if (Object.prototype.hasOwnProperty.call(items, key)) {
        if(items[key].expiry && items[key].expiry < Date.now()){
          keysToBeDeleted.push(key);
        }
      }
    }
    // Now you can delete the keys that are expired
    keysToBeDeleted.forEach(key => {
      chrome.storage.local.remove(key, function() {
        console.log(`Key ${key} removed`);
      });
    });
  });
}

exports.secondsToHourMinuteSecondString = secondsToHourMinuteSecondString;
exports.showNotification = showNotification;
exports.dismissNotification = dismissNotification;
exports.responseMessage = responseMessage;
exports.isObjectEmpty = isObjectEmpty;
exports.getRcInfo = getRcInfo;
exports.getRcAccessToken = getRcAccessToken;
exports.checkC2DCollision = checkC2DCollision;
exports.downloadTextFile = downloadTextFile;
exports.getPlatformInfo = getPlatformInfo;
exports.cleanUpExpiredStorage = cleanUpExpiredStorage;