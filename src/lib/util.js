import { openDB } from 'idb';

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

exports.secondsToHourMinuteSecondString = secondsToHourMinuteSecondString;
exports.showNotification = showNotification;
exports.dismissNotification = dismissNotification;
exports.responseMessage = responseMessage;
exports.isObjectEmpty = isObjectEmpty;
exports.getRcInfo = getRcInfo;
exports.getRcAccessToken = getRcAccessToken;
exports.checkC2DCollision = checkC2DCollision;
exports.downloadTextFile = downloadTextFile;