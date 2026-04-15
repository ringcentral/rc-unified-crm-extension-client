import userCore from '../../../core/user';
import { showNotification, responseMessage } from '../../../lib/util';
import logCore from '../../../core/log';
import contactCore from '../../../core/contact';
import { getLogConflictInfo, logPageFormDataDefaulting, cacheLogPageData } from '../../../lib/logUtil';
import moment from 'moment';
import logPage from '../../../components/logPage';
import groupLogPage from '../../../components/groupLogPage';

async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
  const { userSettings } = await chrome.storage.local.get('userSettings');
  console.log('message log request for', data.body.conversation.conversationLogId, data.body.triggerType);
  // Case: when auto log and auto pop turned ON, we need to know which event is for the conversation that user is looking at
  const { autoPopupMainConverastionId } = await chrome.storage.local.get({ autoPopupMainConverastionId: null });
  if (!autoPopupMainConverastionId) {
    await chrome.storage.local.set({ autoPopupMainConverastionId: data.body.conversation.conversationId });
  }
  if (data?.body?.conversation?.correspondents[0]?.extensionNumber) {
    showNotification({ level: 'warning', message: 'Extension numbers cannot be logged', ttl: 3000 });
    responseMessage(data.requestId, { data: 'ok' });
    return;
  }
  const isAutoLogSMS = userSettings?.autoLogSMS?.value ?? false;
  const isAutoLogVoicemail = userSettings?.autoLogVoicemail?.value ?? false;
  const isAutoLogInboundFax = userSettings?.autoLogInboundFax?.value ?? false;
  const isAutoLogOutboundFax = userSettings?.autoLogOutboundFax?.value ?? false;

  const messageAutoPopup = userCore.getSMSPopSetting(userSettings).value;
  const messageLogPrefId = `rc-crm-conversation-pref-${data.body.conversation.conversationLogId}`;
  const existingConversationLogPref = await chrome.storage.local.get(messageLogPrefId);
  let getContactMatchResult = null;
  let hasConflict = false;
  let autoSelectAdditionalSubmission = {};
  let requireManualDisposition = false;
  // Case: auto log
  if (data.body.triggerType === 'auto' && !messageAutoPopup) {
    // Case: group SMS
    if (data.body.conversation.correspondents.length > 1) {
      showNotification({ level: 'warning', message: 'Group SMS is not supported for auto log. Please log manually.', ttl: 3000 });
      // response to widget
      responseMessage(data.requestId, { data: 'ok' });
      return;
    }
    // Sub-case: has existing pref setup, log directly
    if (existingConversationLogPref[messageLogPrefId]) {
      // auto log - has existing pref
      await logCore.addLog({
        serverUrl: manifest.serverUrl,
        logType: 'Message',
        logInfo: data.body.conversation,
        isMain: true,
        note: '',
        additionalSubmission: existingConversationLogPref[messageLogPrefId].additionalSubmission,
        contactId: existingConversationLogPref[messageLogPrefId].contact.id,
        contactType: existingConversationLogPref[messageLogPrefId].contact.type,
        contactName: existingConversationLogPref[messageLogPrefId].contact.name,
      });
    }
    else {
      getContactMatchResult = (await contactCore.getContact({
        serverUrl: manifest.serverUrl,
        phoneNumber: data.body.conversation.correspondents[0].phoneNumber,
        platformName
      })).contactInfo;
      const getLogConflictInfoResult = await getLogConflictInfo({
        platform,
        isAutoLog: isAutoLogSMS,
        contactInfo: getContactMatchResult,
        logType: 'messageLog',
        direction: '',
        isVoicemail: data.body.conversation.type === 'VoiceMail',
        isFax: data.body.conversation.type === 'Fax'
      });
      hasConflict = getLogConflictInfoResult.hasConflict;
      autoSelectAdditionalSubmission = getLogConflictInfoResult.autoSelectAdditionalSubmission;
      requireManualDisposition = getLogConflictInfoResult.requireManualDisposition;
    }
    switch (data.body.conversation.type) {
      case 'SMS':
        if (isAutoLogSMS) {
          // Sub-case: has conflict
          if (hasConflict) {
            const conflictLog = {
              type: 'Message',
              id: data.body.conversation.conversationId,
              direction: '',
              contactInfo: getContactMatchResult ?? [],
              date: moment(data.body.conversation.messages[0].creationTime).format('MM/DD/YYYY')
            };
            const conflictContent = logCore.getConflictContentFromUnresolvedLog(conflictLog);
            showNotification({ level: 'warning', message: `Message not logged. ${conflictContent.description}.`, ttl: 5000 });
          }
          // Sub-case: no conflict, log directly
          else {
            // auto log, no pref, no conflict
            await logCore.addLog({
              serverUrl: manifest.serverUrl,
              logType: 'Message',
              logInfo: data.body.conversation,
              isMain: true,
              note: '',
              additionalSubmission: autoSelectAdditionalSubmission,
              contactId: getContactMatchResult[0]?.id,
              contactType: getContactMatchResult[0]?.type,
              contactName: getContactMatchResult[0]?.name,
            });
          }
          if (requireManualDisposition) {
            showNotification({ level: 'warning', message: 'Manual disposition might be needed. Please edit logged message to disposition.', ttl: 5000 });
          }
        }
        break;
      case 'VoiceMail':
        if (isAutoLogVoicemail) {
          // Sub-case: has conflict
          if (hasConflict) {
            const conflictLog = {
              type: 'Message',
              id: data.body.conversation.conversationId,
              direction: '',
              contactInfo: getContactMatchResult ?? [],
              date: moment(data.body.conversation.messages[0].creationTime).format('MM/DD/YYYY')
            };
            const conflictContent = logCore.getConflictContentFromUnresolvedLog(conflictLog);
            showNotification({ level: 'warning', message: `Voicemail not logged. ${conflictContent.description}.`, ttl: 5000 });
          }
          // Sub-case: no conflict, log directly
          else {
            // auto log, no pref, no conflict
            await logCore.addLog({
              serverUrl: manifest.serverUrl,
              logType: 'Message',
              logInfo: data.body.conversation,
              isMain: true,
              note: '',
              additionalSubmission: autoSelectAdditionalSubmission,
              contactId: getContactMatchResult[0]?.id,
              contactType: getContactMatchResult[0]?.type,
              contactName: getContactMatchResult[0]?.name,
            });
          }
          if (requireManualDisposition) {
            showNotification({ level: 'warning', message: 'Manual disposition might be needed. Please edit logged message to disposition.', ttl: 5000 });
          }
        }
        break;
      case 'Fax':
        const faxMessage = data.body.conversation.messages[0];
        if (faxMessage.direction === 'Inbound' && isAutoLogInboundFax || faxMessage.direction === 'Outbound' && isAutoLogOutboundFax) {
          // Sub-case: has conflict
          if (hasConflict) {
            const conflictLog = {
              type: 'Message',
              id: data.body.conversation.conversationId,
              direction: '',
              contactInfo: getContactMatchResult ?? [],
              date: moment(data.body.conversation.messages[0].creationTime).format('MM/DD/YYYY')
            };
            const conflictContent = logCore.getConflictContentFromUnresolvedLog(conflictLog);
            showNotification({ level: 'warning', message: `Fax not logged. ${conflictContent.description}.`, ttl: 5000 });
          }
          // Sub-case: no conflict, log directly
          else {
            // auto log, no pref, no conflict
            await logCore.addLog({
              serverUrl: manifest.serverUrl,
              logType: 'Message',
              logInfo: data.body.conversation,
              isMain: true,
              note: '',
              additionalSubmission: autoSelectAdditionalSubmission,
              contactId: getContactMatchResult[0]?.id,
              contactType: getContactMatchResult[0]?.type,
              contactName: getContactMatchResult[0]?.name,
            });
          }
          if (requireManualDisposition) {
            showNotification({ level: 'warning', message: 'Manual disposition might be needed. Please edit logged message to disposition.', ttl: 5000 });
          }
        }
        break;
    }
  }
  // Case: manual log, submit
  else if (data.body.triggerType === 'logForm') {
    // user manaully submit message log form
    // Case: single form
    if (data.body.formData.contact) {
      let additionalSubmission = {};
      const additionalFields = manifest.platforms[platformName].page?.messageLog?.additionalFields ?? [];
      const newContactAdditionalFields = manifest.platforms[platformName].page?.newContact?.additionalFields ?? [];
      for (const f of additionalFields.concat(newContactAdditionalFields)) {
        if (data.body.formData[f.const] != "none") {
          additionalSubmission[f.const] = data.body.formData[f.const];
        }
      }
      let newContactInfo = {};
      if (data.body.formData.contact === 'createNewContact' && data.body.redirect) {
        const newContactResp = await contactCore.createContact({
          serverUrl: manifest.serverUrl,
          phoneNumber: data.body.conversation.correspondents[0].phoneNumber,
          newContactName: data.body.formData.newContactName,
          newContactType: data.body.formData.newContactType,
          additionalSubmission
        });
        newContactInfo = newContactResp.contactInfo;
        if (userCore.getOpenContactAfterCreationSetting(userSettings).value) {
          await contactCore.openContactPage({ manifest, platformName, phoneNumber: data.body.conversation.correspondents[0].phoneNumber, contactId: newContactInfo.id, contactType: data.body.formData.newContactType });
        }
      }
      await logCore.addLog({
        serverUrl: manifest.serverUrl,
        logType: 'Message',
        logInfo: data.body.conversation,
        isMain: true,
        note: '',
        additionalSubmission,
        contactId: newContactInfo?.id ?? data.body.formData.contact,
        contactType: data.body.formData.newContactType === '' ? data.body.formData.contactType : data.body.formData.newContactType,
        contactName: data.body.formData.newContactName === '' ? data.body.formData.contactName : data.body.formData.newContactName,
      });
    }
    // Case: group form
    else {
      for (const form in data.body.formData) {
        const formData = data.body.formData[form];
        let additionalSubmission = {};
        const additionalFields = manifest.platforms[platformName].page?.messageLog?.additionalFields ?? [];
        const newContactAdditionalFields = manifest.platforms[platformName].page?.newContact?.additionalFields ?? [];
        for (const f of additionalFields.concat(newContactAdditionalFields)) {
          if (form[f.const] != "none") {
            additionalSubmission[f.const] = formData[f.const];
          }
        }
        let newContactInfo = {};
        if (formData.contact === 'createNewContact' && data.body.redirect) {
          const newContactResp = await contactCore.createContact({
            serverUrl: manifest.serverUrl,
            phoneNumber: formData.contactPhoneNumber,
            newContactName: formData.newContactName,
            newContactType: formData.newContactType,
            additionalSubmission
          });
          newContactInfo = newContactResp.contactInfo;
          if (userCore.getOpenContactAfterCreationSetting(userSettings).value) {
            await contactCore.openContactPage({ manifest, platformName, phoneNumber: formData.contactPhoneNumber, contactId: newContactInfo.id, contactType: data.body.formData.newContactType });
          }
        }
        await logCore.addLog({
          serverUrl: manifest.serverUrl,
          logType: 'Message',
          logInfo: data.body.conversation,
          isMain: true,
          note: '',
          additionalSubmission,
          contactId: newContactInfo?.id ?? formData.contact,
          contactType: formData.newContactType === '' ? formData.contactType : formData.newContactType,
          contactName: formData.newContactName === '' ? formData.contactName : formData.newContactName,
          contactPhoneNumber: formData.contactPhoneNumber
        });
      }
    }
  }
  // Case: Open page OR auto pop up log page
  else {
    if (data.body.redirect || messageAutoPopup) {
      getContactMatchResult = {};
      for (const correspondent of data.body.conversation.correspondents) {
        const singleContactMatchResult = await contactCore.getContact({
          serverUrl: manifest.serverUrl,
          phoneNumber: correspondent.phoneNumber,
          platformName
        });
        const cachedSearchContactKey = `rc-crm-search-contact-${data.body.conversation.correspondents[0].phoneNumber}`;
        const storageObj = await chrome.storage.local.get(cachedSearchContactKey);
        const cachedContacts = storageObj[cachedSearchContactKey] || [];

        for (const cachedContact of cachedContacts) {
          if (!singleContactMatchResult?.contactInfo?.some(c => c.id === cachedContact.id)) {
            singleContactMatchResult?.contactInfo?.unshift(cachedContact);
          }
        }

        if (singleContactMatchResult?.contactInfo) {
          getContactMatchResult[correspondent.phoneNumber] = singleContactMatchResult?.contactInfo;
        }
      }
      // add your codes here to log call to your service
      await cacheLogPageData({
        id: data.body.conversation.conversationId,
        manifest,
        logType: 'Message',
        triggerType: data.body.triggerType,
        platformName,
        direction: '',
        contactInfo: getContactMatchResult.contactInfo ?? [],
        getContactMatchResult
      });
      const { implementedInterfaces } = await chrome.storage.local.get({ implementedInterfaces: null });
      const useContactSearch = implementedInterfaces?.findContactWithName;
      let messagePage = null;
      if (data.body.conversation.correspondents.length > 1) {
        messagePage = groupLogPage.getGroupLogPageRender({
          id: data.body.conversation.conversationId,
          manifest,
          platformName,
          correspondentsData: getContactMatchResult,
          useContactSearch
        });
      }
      else {
        const contactInfo = getContactMatchResult[data.body.conversation.correspondents[0].phoneNumber];
        messagePage = logPage.getLogPageRender({
          id: data.body.conversation.conversationId,
          manifest,
          logType: 'Message',
          triggerType: data.body.triggerType,
          platformName,
          direction: '',
          contactInfo: contactInfo ?? [],
          contactPhoneNumber: data.body?.conversation?.correspondents[0]?.phoneNumber,
          useContactSearch
        });
      }
      switch (data.body.conversation.type) {
        case 'SMS':
        case 'Thread':
          messagePage = await logPageFormDataDefaulting({
            platform,
            targetPage: messagePage,
            caseType: 'message',
            logType: 'messageLog'
          });
          break;
        case 'Fax':
          messagePage = await logPageFormDataDefaulting({
            platform,
            targetPage: messagePage,
            caseType: 'fax',
            logType: 'messageLog'
          });
          break;
        case 'VoiceMail':
          messagePage = await logPageFormDataDefaulting({
            platform,
            targetPage: messagePage,
            caseType: 'voicemail',
            logType: 'messageLog'
          });
          break;
      }

      document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-update-messages-log-page',
        page: messagePage
      }, '*');

      // navigate to message log page
      document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-navigate-to',
        path: `/log/messages/${data.body.conversation.conversationId}`, // conversation id that you received from message logger event
      }, '*');
    }
  }
  // response to widget
  responseMessage(data.requestId, { data: 'ok' });
}

exports.onEvent = onEvent;