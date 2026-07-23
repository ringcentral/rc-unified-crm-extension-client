import userCore from '../../../core/user';
import { showNotification, responseMessage } from '../../../lib/util';
import logCore from '../../../core/log';
import contactCore from '../../../core/contact';
import { getLogConflictInfo, logPageFormDataDefaulting, cacheLogPageData } from '../../../lib/logUtil';
import moment from 'moment';
import logPage from '../../../components/logPage';
import groupLogPage from '../../../components/groupLogPage';
import { CONSTANTS } from '../../../misc/constant';

type UnknownRecord = Record<string, any>;

type EventOptions = {
  data: UnknownRecord;
  manifest: UnknownRecord;
  platformInfo?: UnknownRecord;
  platformName: string;
  platform: UnknownRecord;
};

function getWidgetFrameWindow(): Window {
  return document.querySelector<HTMLIFrameElement>('#rc-widget-adapter-frame')!.contentWindow!;
}

async function onEvent({ data, manifest, platformInfo, platformName, platform }: EventOptions) {
  void platformInfo;
  const { userSettings } = await chrome.storage.local.get('userSettings') as { userSettings: UnknownRecord };
  console.log('message log request for', data.body.conversation.conversationLogId, data.body.triggerType);
  // Case: when auto log and auto pop turned ON, we need to know which event is for the conversation that user is looking at
  const { autoPopupMainConverastionId } = await chrome.storage.local.get({ autoPopupMainConverastionId: null }) as { autoPopupMainConverastionId?: string | null };
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
  const existingConversationLogPref = await chrome.storage.local.get(messageLogPrefId) as UnknownRecord;
  let getContactMatchResult: any = null;
  let hasConflict = false;
  let autoSelectAdditionalSubmission: UnknownRecord = {};
  let requireManualDisposition = false;

  // Render and open the message log form (contact-selection page) for the
  // current conversation. Shared by the auto-popup/manual-open flow and by the
  // granular "log selected messages" flow so that clicking Log always lets the
  // user confirm the contact before anything is sent to the CRM.
  //
  // `renderTriggerType` controls only how the page is built by
  // `logPage.getLogPageRender` (which only understands 'createLog' | 'manual' |
  // 'auto' | 'editLog'). The subsequent form Save is always dispatched by the
  // widget as `triggerType: 'logForm'`, so the render trigger type does not
  // affect submit routing. It defaults to the incoming event trigger type, but
  // callers whose trigger type is not a valid render type (e.g. 'selectedLog')
  // MUST pass a supported value so the contact field is rendered.
  async function openMessageLogPage(renderTriggerType: string = data.body.triggerType) {
    getContactMatchResult = {};
    for (const correspondent of data.body.conversation.correspondents) {
      const singleContactMatchResult = await contactCore.getContact({
        serverUrl: manifest.serverUrl,
        phoneNumber: correspondent.phoneNumber,
        platformName
      });
      const cachedSearchContactKey = `rc-crm-search-contact-${data.body.conversation.correspondents[0].phoneNumber}`;
      const storageObj = await chrome.storage.local.get(cachedSearchContactKey) as UnknownRecord;
      const cachedContacts = (storageObj[cachedSearchContactKey] || []) as UnknownRecord[];

      for (const cachedContact of cachedContacts) {
        if (!singleContactMatchResult?.contactInfo?.some((c: UnknownRecord) => c.id === cachedContact.id)) {
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
      triggerType: renderTriggerType,
      platformName,
      direction: '',
      contactInfo: getContactMatchResult.contactInfo ?? [],
      getContactMatchResult
    });
    const { implementedInterfaces } = await chrome.storage.local.get({ implementedInterfaces: null }) as { implementedInterfaces?: UnknownRecord | null };
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
        triggerType: renderTriggerType,
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

    getWidgetFrameWindow().postMessage({
      type: 'rc-adapter-update-messages-log-page',
      page: messagePage
    }, '*');

    // navigate to message log page
    getWidgetFrameWindow().postMessage({
      type: 'rc-adapter-navigate-to',
      path: `/log/messages/${data.body.conversation.conversationId}`, // conversation id that you received from message logger event
    }, '*');
  }

  // Case: auto log
  if (data.body.triggerType === 'auto' && !messageAutoPopup) {
    // Case: group SMS
    if (data.body.conversation.correspondents.length > 1) {
      // Group auto-log is only supported for SMS conversations
      if (data.body.conversation.type !== 'SMS') {
        showNotification({ level: 'warning', message: 'Group messages of this type are not supported for auto log. Please log manually.', ttl: 3000 });
        responseMessage(data.requestId, { data: 'ok' });
        return;
      }
      if (isAutoLogSMS) {
        // Resolve every correspondent independently. Ambiguous (multiple matches) or unmatched
        // (unknown contact) members are handled per the beta auto-log preferences instead of
        // blocking the whole group. Members that can't be resolved are skipped (default) and
        // reported afterwards so the resolvable members still get logged.
        const unknownContactPreference = userCore.getUnknownContactPreferenceSetting(userSettings).value;
        const multipleContactsPreference = userCore.getMultipleContactsPreferenceSetting(userSettings).value;
        let groupRequireManualDisposition = false;
        let skippedMemberCount = 0;
        for (const correspondent of data.body.conversation.correspondents) {
          const contactInfo = (await contactCore.getContact({
            serverUrl: manifest.serverUrl,
            phoneNumber: correspondent.phoneNumber,
            platformName
          })).contactInfo ?? [];
          const conflictInfo = await getLogConflictInfo({
            platform,
            isAutoLog: isAutoLogSMS,
            contactInfo,
            logType: 'messageLog',
            direction: '',
            isVoicemail: false,
            isFax: false
          });
          const existingContacts = contactInfo.filter(c => !c.isNewContact);
          let defaultingContact = existingContacts.find(c => c.toNumberEntity) ?? existingContacts[0];
          // Sub-case: no matching contact for this member
          if (conflictInfo.conflictType === CONSTANTS.UNKNOWN_CONTACT_CONFLICT_TYPE) {
            if (unknownContactPreference === 'createNewPlaceholderContact') {
              const newContactType = userCore.getNewContactTypeSetting(userSettings, platform.contactTypes).value;
              let newContactName = (correspondent.name ? `${correspondent.name} ` : '') + correspondent.phoneNumber;
              newContactName = userCore.getNewContactNamePrefixSetting(userSettings).value + newContactName;
              let additionalSubmission = {};
              if (platform.page?.newContact?.additionalFields) {
                const newContactUnderType = contactInfo[0]?.additionalInfo?.[newContactType];
                if (newContactUnderType) {
                  for (const fieldKey of Object.keys(newContactUnderType)) {
                    additionalSubmission[fieldKey] = Array.isArray(newContactUnderType[fieldKey]) ? newContactUnderType[fieldKey][0].const : newContactUnderType[fieldKey];
                  }
                }
              }
              const newContactResp = await contactCore.createContact({
                serverUrl: manifest.serverUrl,
                phoneNumber: correspondent.phoneNumber,
                newContactName,
                newContactType,
                additionalSubmission
              }) as UnknownRecord;
              defaultingContact = newContactResp.contactInfo;
            }
            else {
              // Default: skip logging for this member
              skippedMemberCount++;
              continue;
            }
          }
          // Sub-case: multiple contacts matched for this member
          else if (conflictInfo.conflictType === CONSTANTS.MULTIPLE_CONTACTS_CONFLICT_TYPE) {
            switch (multipleContactsPreference) {
              case 'firstAlphabetical':
                defaultingContact = [...existingContacts].sort((a, b) => a.name.localeCompare(b.name))[0];
                break;
              case 'mostRecentActivity':
                defaultingContact = [...existingContacts].sort((a, b) => new Date(b.mostRecentActivityDate).getTime() - new Date(a.mostRecentActivityDate).getTime())[0];
                break;
              case 'skipLogging':
              default:
                // Default: skip logging for this member
                skippedMemberCount++;
                continue;
            }
          }
          if (conflictInfo.requireManualDisposition) {
            groupRequireManualDisposition = true;
          }
          await logCore.addLog({
            serverUrl: manifest.serverUrl,
            logType: 'Message',
            logInfo: data.body.conversation,
            isMain: true,
            note: '',
            additionalSubmission: conflictInfo.autoSelectAdditionalSubmission,
            contactId: defaultingContact?.id,
            contactType: defaultingContact?.type,
            contactName: defaultingContact?.name,
            contactPhoneNumber: correspondent.phoneNumber
          });
        }
        if (skippedMemberCount > 0) {
          showNotification({ level: 'warning', message: `${skippedMemberCount} group member(s) could not be auto-logged (no match or multiple matches). Please log them manually.`, ttl: 5000 });
        }
        if (groupRequireManualDisposition) {
          showNotification({ level: 'warning', message: 'Manual disposition might be needed. Please edit logged message to disposition.', ttl: 5000 });
        }
      }
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
      responseMessage(data.requestId, { data: 'ok' });
      return;
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
  // Case: granular, message-level logging.
  // The user selected specific messages in the thread and clicked Log. The
  // widget resolves the target contact in its own UI and passes it here
  // (contactId/contactType/contactName/additionalSubmission), then expects a
  // `logId` back so it can mark exactly those messages as logged. We therefore
  // log the selected messages as a single CRM entry using the SAME payload
  // shape as normal manual SMS logging (the backend uses one shared flow) and
  // return the resulting log id. If no contact was resolved, we fall back to
  // opening the contact-selection form and logging on submit.
  else if (data.body.triggerType === 'selectedLog') {
    // Gate: this feature is only available when the platform manifest opts in
    // via `isSelectedMessageLogSupported: true`. Otherwise keep existing
    // behavior and ignore the event.
    if (platform?.isSelectedMessageLogSupported !== true) {
      responseMessage(data.requestId, { data: 'ok' });
      return;
    }
    const selectedIds: string[] = (Array.isArray(data.body.selectedMessageIds) ? data.body.selectedMessageIds : []).map((id: unknown) => String(id));
    const selectedIdSet = new Set(selectedIds);
    const selectedMessages = (data.body.conversation.messages ?? []).filter((m: UnknownRecord) => selectedIdSet.has(String(m?.id)));
    if (selectedMessages.length === 0) {
      showNotification({ level: 'warning', message: 'No messages selected to log.', ttl: 3000 });
      responseMessage(data.requestId, { data: 'ok' });
      return;
    }
    // Sub-case: the widget already resolved a contact. Log directly, mirroring
    // the normal message-log payload (contactId/contactType/contactName/
    // additionalSubmission) plus `selectedMessageIds`, and return the log id.
    if (data.body.contactId) {
      const addLogResult = await logCore.addLog({
        serverUrl: manifest.serverUrl,
        logType: 'Message',
        logInfo: data.body.conversation,
        isMain: true,
        note: '',
        additionalSubmission: data.body.additionalSubmission ?? {},
        contactId: data.body.contactId,
        contactType: data.body.contactType,
        contactName: data.body.contactName,
        selectedMessageIds: selectedIds,
      });
      responseMessage(data.requestId, {
        data: {
          logId: addLogResult?.logId,
          logIds: addLogResult?.logIds,
          messageLogs: addLogResult?.messageLogs,
        }
      });
      return;
    }
    // Sub-case: no contact resolved yet. Persist the selection snapshot so the
    // subsequent logForm submit for this conversation logs exactly these
    // messages as a single entry, then open the contact-selection form.
    await chrome.storage.local.set({
      [`rc-crm-message-selection-${data.body.conversation.conversationId}`]: selectedIds
    });
    // Open the contact-selection log form (no CRM write yet). Render it as a
    // normal manual/new log page ('selectedLog' is not a valid render trigger
    // type, which would otherwise produce an empty page without a contact
    // field and drop the contact on submit).
    await openMessageLogPage('createLog');
    responseMessage(data.requestId, { data: 'ok' });
    return;
  }
  // Case: manual log, submit
  else if (data.body.triggerType === 'logForm') {
    // If this submit corresponds to a granular message selection, forward the
    // selected message ids to the server (top-level `selectedMessageIds`). The
    // server keeps the full conversation for message content and composes a
    // single CRM entry from exactly those ids, returning a per-message ->
    // log-id map. Absent/empty selection keeps the existing daily-digest path.
    const selectionKey = `rc-crm-message-selection-${data.body.conversation.conversationId}`;
    const storedSelection = (await chrome.storage.local.get(selectionKey) as UnknownRecord)[selectionKey];
    const hasSelection = Array.isArray(storedSelection) && storedSelection.length > 0;
    const selectedMessageIds = hasSelection ? storedSelection.map((id: unknown) => String(id)) : undefined;
    const logConversation = data.body.conversation;
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
      let newContactInfo: UnknownRecord = {};
      if (data.body.formData.contact === 'createNewContact' && data.body.redirect) {
        const newContactResp = await contactCore.createContact({
          serverUrl: manifest.serverUrl,
          phoneNumber: data.body.conversation.correspondents[0].phoneNumber,
          newContactName: data.body.formData.newContactName,
          newContactType: data.body.formData.newContactType,
          additionalSubmission
        }) as UnknownRecord;
        newContactInfo = newContactResp.contactInfo;
        if (userCore.getopenContactPageAfterCreationSetting(userSettings).value) {
          await contactCore.openContactPage({ manifest, platformName, phoneNumber: data.body.conversation.correspondents[0].phoneNumber, contactId: newContactInfo.id, contactType: data.body.formData.newContactType });
        }
      }
      await logCore.addLog({
        serverUrl: manifest.serverUrl,
        logType: 'Message',
        logInfo: logConversation,
        isMain: true,
        note: '',
        additionalSubmission,
        contactId: newContactInfo?.id ?? data.body.formData.contact,
        contactType: data.body.formData.newContactType === '' ? data.body.formData.contactType : data.body.formData.newContactType,
        contactName: data.body.formData.newContactName === '' ? data.body.formData.contactName : data.body.formData.newContactName,
        selectedMessageIds,
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
        let newContactInfo: UnknownRecord = {};
        if (formData.contact === 'createNewContact' && data.body.redirect) {
          const newContactResp = await contactCore.createContact({
            serverUrl: manifest.serverUrl,
            phoneNumber: formData.contactPhoneNumber,
            newContactName: formData.newContactName,
            newContactType: formData.newContactType,
            additionalSubmission
          }) as UnknownRecord;
          newContactInfo = newContactResp.contactInfo;
          if (userCore.getopenContactPageAfterCreationSetting(userSettings).value) {
            await contactCore.openContactPage({ manifest, platformName, phoneNumber: formData.contactPhoneNumber, contactId: newContactInfo.id, contactType: data.body.formData.newContactType });
          }
        }
        await logCore.addLog({
          serverUrl: manifest.serverUrl,
          logType: 'Message',
          logInfo: logConversation,
          isMain: true,
          note: '',
          additionalSubmission,
          contactId: newContactInfo?.id ?? formData.contact,
          contactType: formData.newContactType === '' ? formData.contactType : formData.newContactType,
          contactName: formData.newContactName === '' ? formData.contactName : formData.newContactName,
          contactPhoneNumber: formData.contactPhoneNumber,
          selectedMessageIds,
        });
      }
    }
    // Selection has been consumed; clear it so future full-conversation logs of
    // this thread are not accidentally filtered.
    if (hasSelection) {
      await chrome.storage.local.remove(selectionKey);
    }
  }
  // Case: Open page OR auto pop up log page
  else {
    if (data.body.redirect || messageAutoPopup) {
      await openMessageLogPage();
    }
  }
  // response to widget
  responseMessage(data.requestId, { data: 'ok' });
}

export { onEvent };
export default {
  onEvent,
};
