import { showNotification } from '../../../lib/util';
import authCore from '../../../core/auth';
import { responseMessage } from '../../../lib/util';
import { clearPlatformInfo } from '../../../service/platformService';

import customizedBannerHandler from './customizedBanner';

import callLaterHandler from './callLater';
import callLaterInMessageHandler from './callLaterInMessage';
import callLaterInContactHandler from './callLaterInContact';
import scheduleSubmitHandler from './scheduleSubmit';
import calldownActionCallHandler from './calldownActionCall';
import calldownActionOpenHandler from './calldownActionOpen';
import calldownActionTextHandler from './calldownActionText';
import calldownActionEditHandler from './calldownActionEdit';
import calldownActionCompleteHandler from './calldownActionComplete';
import calldownActionRemoveHandler from './calldownActionRemove';
import editUserMappingPageHandler from './editUserMappingPage';
import hostnameInputPageHandler from './hostnameInputPage';
import insightlyGetApiKeyHandler from './insightlyGetApiKey';
import authPageHandler from './authPage';
import feedbackPageHandler from './feedbackPage';
import openAboutPageHandler from './openAboutPage';
import openDeveloperSettingsPageHandler from './openDeveloperSettingsPage';
import reinitializeUserMappingButtonHandler from './reinitializeUserMappingButton';
import openImplementedInterfacesPageButtonHandler from './openImplementedInterfacesPageButton';
import factoryResetButtonHandler from './factoryResetButton';
import reportIssueButtonHandler from './reportIssueButton';
import documentationHandler from './documentation';
import saveServerSideLoggingButtonHandler from './saveServerSideLoggingButton';
import doNotLogNumbersSubmitButtonHandler from './doNotLogNumbersSubmitButton';
import saveTempNoteButtonHandler from './saveTempNoteButton';
import googleSheetsConfigHandler from './googleSheetsConfig';
import newSheetButtonHandler from './newSheetButton';
import selectExistingSheetButtonHandler from './selectExistingSheetButton';
import removeSheetButtonHandler from './removeSheetButton';
import adminNewSheetButtonHandler from './adminNewSheetButton';
import adminSelectExistingSheetButtonHandler from './adminSelectExistingSheetButton';
import adminGoogleSheetSelectedHandler from './adminGoogleSheetSelected';
import userGoogleSheetSelectedHandler from './userGoogleSheetSelected';
import adminRemoveSheetButtonHandler from './adminRemoveSheetButton';
import contactSearchAdapterButtonCallLogHandler from './contactSearchAdapterButtonCallLog';
import contactSearchAdapterButtonMessageLogHandler from './contactSearchAdapterButtonMessageLog';
import usermappingEditHandler from './usermappingEdit';
import usermappingRemoveHandler from './usermappingRemove';
import selectPlatformHandler from './selectPlatform';
import getErrorLogRecordPageNextStepButtonHandler from './getErrorLogRecordPageNextStepButton';
import errorLogRecordPageStartButtonHandler from './errorLogRecordPageStartButton';
import logRecordSubmissionPageHandler from './logRecordSubmissionPage';
import openProcessorListPageHandler from './processorListPage';
import selectProcessorHandler from './selectProcessor';
import processorConfigurePageSubmitHandler from './processorConfigurePageSubmit';
import generalHandler from './general';
import processorAuthHandler from './processorAuth';

async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    switch (data.body.button.type) {
        case 'customizedBanner':
            await customizedBannerHandler.onEvent({ data, manifest, platformInfo, platformName, platform });
            break;
    }
    // button id is: {actionId}-{itemId}-action
    const listButtonActionIdAndItemId = data.body.button.id.split('-action')[0]; // {actionId}-{itemId}
    const listButtonActionId = listButtonActionIdAndItemId.split('-')[0]; // {actionId}
    const listButtonItemId = listButtonActionIdAndItemId.split(`${listButtonActionId}-`)[1]; // {itemId}
    switch (listButtonActionId) {
        case 'callLater':
            await callLaterHandler.onEvent({ data, manifest, platformInfo, platformName, platform });
            break;
        case 'callLaterInMessage':
            await callLaterInMessageHandler.onEvent({ data, manifest, platformInfo, platformName, platform });
            break;
        case 'callLaterInContact':
            await callLaterInContactHandler.onEvent({ data, manifest, platformInfo, platformName, platform });
            break;
        case 'scheduleSubmit': // submit on schedule page
            await scheduleSubmitHandler.onEvent({ data, manifest, platformInfo, platformName, platform });
            break;
        case 'calldownActionCall':
            await calldownActionCallHandler.onEvent({ data, manifest, platformInfo, platformName, platform, listButtonItemId });
            break;
        case 'calldownActionOpen':
            await calldownActionOpenHandler.onEvent({ data, manifest, platformInfo, platformName, platform, listButtonItemId });
            break;
        case 'calldownActionText':
            await calldownActionTextHandler.onEvent({ data, manifest, platformInfo, platformName, platform, listButtonItemId });
            break;
        case 'calldownActionEdit':
            await calldownActionEditHandler.onEvent({ data, manifest, platformInfo, platformName, platform, listButtonItemId });
            break;
        case 'calldownActionComplete':
            await calldownActionCompleteHandler.onEvent({ data, manifest, platformInfo, platformName, platform, listButtonItemId });
            break;
        case 'calldownActionRemove':
            await calldownActionRemoveHandler.onEvent({ data, manifest, platformInfo, platformName, platform, listButtonItemId });
            break;
        case 'editUserMappingPage':
            await editUserMappingPageHandler.onEvent({ data, manifest, platformInfo, platformName, platform });
            break;
        case 'hostnameInputPage':
            await hostnameInputPageHandler.onEvent({ data, manifest, platformInfo, platformName, platform });
            break;
        case 'insightlyGetApiKey':
            await insightlyGetApiKeyHandler.onEvent({ data, manifest, platformInfo, platformName, platform });
            break;
        case 'authPage':
            await authPageHandler.onEvent({ data, manifest, platformInfo, platformName, platform });
            break;
        case 'feedbackPage':
            await feedbackPageHandler.onEvent({ data, manifest, platformInfo, platformName, platform });
            break;
        case 'openProcessorListPage':
            await openProcessorListPageHandler.onEvent({ data, manifest, platformInfo, platformName, platform });
            break;
        case 'openSupportPage':
            chrome.runtime.sendMessage({ type: "openPopupWindow", navigationPath: "/support" });
            break;
        case 'openAboutPage':
            await openAboutPageHandler.onEvent({ data, manifest, platformInfo, platformName, platform });
            break;
        case 'openDeveloperSettingsPage':
            await openDeveloperSettingsPageHandler.onEvent({ data, manifest, platformInfo, platformName, platform });
            break;
        case 'reinitializeUserMappingButton':
            await reinitializeUserMappingButtonHandler.onEvent({ data, manifest, platformInfo, platformName, platform });
            break;
        case 'factoryResetButton':
            await factoryResetButtonHandler.onEvent({ data, manifest, platformInfo, platformName, platform });
            break;
        case 'reportIssueButton':
            await reportIssueButtonHandler.onEvent({ data, manifest, platformInfo, platformName, platform });
            break;
        case 'openCommunityPageButton':
            window.open('https://community.ringcentral.com/groups/app-connect-22', '_blank');
            break;
        case 'documentation':
            await documentationHandler.onEvent({ data, manifest, platformInfo, platformName, platform });
            break;
        case 'releaseNotes':
            if (platform?.releaseNotesUrl) { window.open(platform.releaseNotesUrl); }
            break;
        case 'getSupport':
            if (platform?.getSupportUrl) { window.open(platform.getSupportUrl); }
            break;
        case 'writeReview':
            if (platform?.writeReviewUrl) { window.open(platform.writeReviewUrl); }
            break;
        case 'saveServerSideLoggingButton':
            await saveServerSideLoggingButtonHandler.onEvent({ data, manifest, platformInfo, platformName, platform, responseMessage });
            break;
        case 'doNotLogNumbersSubmitButton':
            await doNotLogNumbersSubmitButtonHandler.onEvent({ data, manifest, platformInfo, platformName, platform });
            break;
        case 'clearPlatformInfoButton':
            await clearPlatformInfo();
            showNotification({ level: 'success', message: 'Platform info cleared. Please close the extension and open from CRM page.', ttl: 5000 });
            break;
        case 'openImplementedInterfacesPageButton':
            await openImplementedInterfacesPageButtonHandler.onEvent({ data, manifest, platformInfo, platformName, platform });
            break;
        case 'saveTempNoteButton':
            await saveTempNoteButtonHandler.onEvent({ data, manifest, platformInfo, platformName, platform });
            break;
        case 'googleSheetsConfig':
            await googleSheetsConfigHandler.onEvent({ data, manifest, platformInfo, platformName, platform });
            break;
        case 'newSheetButton':
            await newSheetButtonHandler.onEvent({ data, manifest, platformInfo, platformName, platform });
            break;
        case 'selectExistingSheetButton':
            await selectExistingSheetButtonHandler.onEvent({ data, manifest, platformInfo, platformName, platform });
            break;
        case 'sheetInfoButton':
            window.open(data.body.button.formData.sheetUrl, '_blank');
            break;
        case 'removeSheetButton':
            await removeSheetButtonHandler.onEvent({ data, manifest, platformInfo, platformName, platform });
            break;
        case 'adminNewSheetButton':
            await adminNewSheetButtonHandler.onEvent({ data, manifest, platformInfo, platformName, platform });
            break;
        case 'adminSelectExistingSheetButton':
            await adminSelectExistingSheetButtonHandler.onEvent({ data, manifest, platformInfo, platformName, platform });
            break;
        case 'adminGoogleSheetSelected':
            await adminGoogleSheetSelectedHandler.onEvent({ data, manifest, platformInfo, platformName, platform });
            break;
        case 'userGoogleSheetSelected':
            await userGoogleSheetSelectedHandler.onEvent({ data, manifest, platformInfo, platformName, platform });
            break;
        case 'adminRemoveSheetButton':
            await adminRemoveSheetButtonHandler.onEvent({ data, manifest, platformInfo, platformName, platform });
            break;
        case 'adminSheetInfoButton':
            window.open(data.body.button.formData.sheetUrl, '_blank');
            break;
        case 'contactSearchAdapterButtonCallLog':
            await contactSearchAdapterButtonCallLogHandler.onEvent({ data, manifest, platformInfo, platformName, platform });
            break;
        case 'contactSearchAdapterButtonMessageLog':
            await contactSearchAdapterButtonMessageLogHandler.onEvent({ data, manifest, platformInfo, platformName, platform });
            break;
        case 'refreshLicense':
            if (platform.useLicense) { await authCore.refreshLicenseStatus({ serverUrl: manifest.serverUrl }); }
            break;
        case 'usermappingEdit':
            await usermappingEditHandler.onEvent({ data, manifest, platformInfo, platformName, platform, listButtonItemId });
            break;
        case 'usermappingRemove':
            await usermappingRemoveHandler.onEvent({ data, manifest, platformInfo, platformName, platform, listButtonItemId });
            break;
        case 'selectPlatform':
            await selectPlatformHandler.onEvent({ data, manifest, platformInfo, platformName, platform, listButtonItemId });
            break;
        case 'getErrorLogRecordPageNextStepButton':
            await getErrorLogRecordPageNextStepButtonHandler.onEvent({ data, manifest, platformInfo, platformName, platform });
            break;
        case 'errorLogRecordPageStartButton':
            await errorLogRecordPageStartButtonHandler.onEvent({ data, manifest, platformInfo, platformName, platform });
            break;
        case 'logRecordSubmitButton':
            await logRecordSubmissionPageHandler.onEvent({ data, manifest, platformInfo, platformName, platform });
            break;
        case 'selectProcessor':
            await selectProcessorHandler.onEvent({ data, manifest, platformInfo, platformName, platform, listButtonItemId });
            break;
        case 'processorConfigurePage':
            if (data.body.button.type === 'submit') {
                await processorConfigurePageSubmitHandler.onEvent({ data, manifest, platformInfo, platformName, platform });
            }
            break;
        case 'callAndSMSLoggingSettingPage':
        case 'contactSettingPage':
        case 'callLogDetailsSettingPage':
        case 'autoLogPreferenceSettingPage':
        case 'advancedFeaturesSettingPage':
        case 'customSettingsPage':
        case 'customizeTabsSettingPage':
        case 'widgetSettingsPage':
        case 'notificationLevelSettingPage':
        case 'phoneNumberFormatPage':
        case 'clickToDialEmbedPage':
            await generalHandler.onEvent({ data, manifest, platformInfo, platformName, platform, responseMessage });
            break;
    }
    if (data.body.button.id.startsWith('link-button-')) {
        window.open(data.body.button.formData[data.body.button.id], '_blank');
    }
    // PTP auth button
    const isPTP = !!data.body.button?.formData?.processorId;
    if (data.body.button.type != 'submit' && isPTP) {
        await processorAuthHandler.onEvent({ data, manifest, platformInfo, platformName, platform });
    }
    responseMessage(data.requestId, { data: 'ok' });
}

exports.onEvent = onEvent;