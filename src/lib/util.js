import { openDB } from 'idb';
import { trackCRMSetupError } from '../lib/analytics';
import rcAPI from '../lib/rcAPI';

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
  const { notificationLevelSetting } = await chrome.storage.local.get({ notificationLevelSetting: ['success', 'warning', 'error'] });
  if (!notificationLevelSetting.includes(level)) {
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

async function getRcContactInfo() {
  const extId = JSON.parse(localStorage.getItem('sdk-rc-widgetplatform')).owner_id;
  const indexDB = await openDB(`rc-widget-storage-${extId}`, 2);
  const rcContactInfo = await indexDB.get('keyvaluepairs', 'CompanyContacts-companyContactsData');
  return rcContactInfo?.value ?? [];
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

function cleanUpExpiredStorage() {
  chrome.storage.local.get(null, function (items) {
    // 'items' is an object containing all key-value pairs
    // stored in chrome.storage.local.
    console.log("Start cleaning expired items");
    const keysToBeDeleted = [];
    // You can now process the 'items' object
    for (let key in items) {
      if (Object.prototype.hasOwnProperty.call(items, key)) {
        if (items[key].expiry && items[key].expiry < Date.now()) {
          keysToBeDeleted.push(key);
        }
      }
    }
    // Now you can delete the keys that are expired
    keysToBeDeleted.forEach(key => {
      chrome.storage.local.remove(key, function () {
        console.log(`Key ${key} removed`);
      });
    });
  });
}

async function getUserReportStats({ dateRange, customStartDate, customEndDate }) {
  const rcAccessToken = getRcAccessToken();
  const callLogData = await rcAPI.getRcCallLog({ rcAccessToken, dateRange, customStartDate, customEndDate });
  // phone activity
  const inboundCallCount = callLogData.records.filter(call => call.direction === 'Inbound').length;
  const outboundCallCount = callLogData.records.filter(call => call.direction === 'Outbound').length;
  const answeredCallCount = callLogData.records.filter(call => call.direction === 'Inbound' && (call.result === 'Call connected' || call.result === 'Accepted' || call.result === 'Answered Not Accepted')).length;
  const answeredCallPercentage = answeredCallCount === 0 ? '0%' : `${((answeredCallCount / (inboundCallCount || 1)) * 100).toFixed(2)}%`;
  // phone engagement
  const totalTalkTime = Math.round(callLogData.records.reduce((acc, call) => acc + (call.duration || 0), 0) / 60) || 0;
  const averageTalkTime = Math.round(totalTalkTime / (inboundCallCount + outboundCallCount)) || 0;
  // sms activity
  const smsLogData = await rcAPI.getRcSMSLog({ rcAccessToken, dateRange, customStartDate, customEndDate });
  const smsSentCount = smsLogData.records.filter(sms => sms.direction === 'Outbound').length;
  const smsReceivedCount = smsLogData.records.filter(sms => sms.direction === 'Inbound').length;
  const { calls, hasMore } = await RCAdapter.getUnloggedCalls(100, 1);
  const unloggedCallCount = calls.length;
  const reportStats = {
    dateRange,
    callLogStats: {
      inboundCallCount,
      outboundCallCount,
      answeredCallCount,
      answeredCallPercentage,
      totalTalkTime,
      averageTalkTime
    },
    smsLogStats: {
      smsSentCount,
      smsReceivedCount
    },
    unloggedCallStats: {
      unloggedCallCount
    }
  };
  if (dateRange === 'Select date range...') {
    reportStats.startDate = customStartDate;
    reportStats.endDate = customEndDate;
  }
  return reportStats;
}

// Debounce storage for different operations
const debounceStorage = new Map();

function createDebounceHandler(handlerKey, delay = 300) {
  return function (request, handlerFunction) {
    // Get or create debounce object for this handler
    let debounceObj = debounceStorage.get(handlerKey);

    if (!debounceObj) {
      debounceObj = {};
      debounceStorage.set(handlerKey, debounceObj);
    } else {
      // Clear previous timeout
      const timeout = debounceObj.timeout;
      clearTimeout(timeout);
    }

    // Store current request
    debounceObj.request = request;

    // Set new timeout
    debounceObj.timeout = setTimeout(async () => {
      // Clear debounce object
      debounceStorage.delete(handlerKey);

      try {
        // Execute the handler function
        const result = await handlerFunction(request);

      } catch (error) {
        console.error(`Debounced handler error for ${handlerKey}:`, error);
      }
    }, delay);
  };
}

exports.secondsToHourMinuteSecondString = secondsToHourMinuteSecondString;
exports.showNotification = showNotification;
exports.dismissNotification = dismissNotification;
exports.responseMessage = responseMessage;
exports.isObjectEmpty = isObjectEmpty;
exports.getRcInfo = getRcInfo;
exports.getRcAccessToken = getRcAccessToken;
exports.getRcContactInfo = getRcContactInfo;
exports.checkC2DCollision = checkC2DCollision;
exports.downloadTextFile = downloadTextFile;
exports.cleanUpExpiredStorage = cleanUpExpiredStorage;
exports.getUserReportStats = getUserReportStats;
exports.createDebounceHandler = createDebounceHandler;