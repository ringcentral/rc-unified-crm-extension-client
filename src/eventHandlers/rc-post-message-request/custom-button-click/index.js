import { showNotification } from '../../../lib/util';
import authCore from '../../../core/auth';
import { responseMessage } from '../../../lib/util';
import { clearPlatformInfo } from '../../../service/platformService';

import customizedBannerHandler from './navigation/customizedBanner';

import callLaterHandler from './calldown/callLater';
import callLaterInMessageHandler from './calldown/callLaterInMessage';
import callLaterInContactHandler from './calldown/callLaterInContact';
import scheduleSubmitHandler from './calldown/scheduleSubmit';
import calldownActionCallHandler from './calldown/calldownActionCall';
import calldownActionOpenHandler from './calldown/calldownActionOpen';
import calldownActionTextHandler from './calldown/calldownActionText';
import calldownActionEditHandler from './calldown/calldownActionEdit';
import calldownActionCompleteHandler from './calldown/calldownActionComplete';
import calldownActionRemoveHandler from './calldown/calldownActionRemove';
import saveTempNoteButtonHandler from './calldown/saveTempNoteButton';

import editUserMappingPageHandler from './userMapping/editUserMappingPage';
import reinitializeUserMappingButtonHandler from './userMapping/reinitializeUserMappingButton';
import usermappingEditHandler from './userMapping/usermappingEdit';
import usermappingRemoveHandler from './userMapping/usermappingRemove';

import hostnameInputPageHandler from './auth/hostnameInputPage';
import insightlyGetApiKeyHandler from './auth/insightlyGetApiKey';
import authPageHandler from './auth/authPage';
import factoryResetButtonHandler from './auth/factoryResetButton';
import selectPlatformHandler from './auth/selectPlatform';

import feedbackPageHandler from './navigation/feedbackPage';
import openAboutPageHandler from './navigation/openAboutPage';
import openDeveloperSettingsPageHandler from './navigation/openDeveloperSettingsPage';
import openImplementedInterfacesPageButtonHandler from './navigation/openImplementedInterfacesPageButton';
import documentationHandler from './navigation/documentation';

import reportIssueButtonHandler from './errorLogging/reportIssueButton';
import getErrorLogRecordPageNextStepButtonHandler from './errorLogging/errorLogRecordPageNextStep';
import errorLogRecordPageStartButtonHandler from './errorLogging/errorLogRecordPageStart';
import logRecordSubmissionPageHandler from './errorLogging/logRecordSubmit';

import saveServerSideLoggingButtonHandler from './adminSettings/saveServerSideLogging';
import doNotLogNumbersSubmitButtonHandler from './adminSettings/doNotLogNumbersSubmit';
import generalHandler from './adminSettings/adminSettingsFormSubmit';

import googleSheetsConfigHandler from './googleSheets/googleSheetsConfig';
import newSheetButtonHandler from './googleSheets/newSheetButton';
import selectExistingSheetButtonHandler from './googleSheets/selectExistingSheetButton';
import removeSheetButtonHandler from './googleSheets/removeSheetButton';
import adminNewSheetButtonHandler from './googleSheets/adminNewSheetButton';
import adminSelectExistingSheetButtonHandler from './googleSheets/adminSelectExistingSheetButton';
import adminGoogleSheetSelectedHandler from './googleSheets/adminGoogleSheetSelected';
import userGoogleSheetSelectedHandler from './googleSheets/userGoogleSheetSelected';
import adminRemoveSheetButtonHandler from './googleSheets/adminRemoveSheetButton';

import contactSearchAdapterButtonCallLogHandler from './contactSearch/contactSearchAdapterButtonCallLog';
import contactSearchAdapterButtonMessageLogHandler from './contactSearch/contactSearchAdapterButtonMessageLog';

import openInstalledPluginListPageHandler from './plugins/installedPluginListPage';
import selectPluginHandler from './plugins/selectPlugin';
import pluginConfigurePageSubmitHandler from './plugins/pluginConfigurePageSubmit';
import pluginConfigButtonsHandler from './plugins/pluginConfigButtons';
import pluginAdminConfigButtonsHandler from './plugins/pluginAdminConfigButtons';
import pluginDetailsSettingPageHandler from './plugins/pluginDetailsSettingPage';

import pluginMarketListPageHandler from '../pluginMarketListPage';

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
        case 'openInstalledPluginListPage':
            await openInstalledPluginListPageHandler.onEvent({ data, manifest, platformInfo, platformName, platform });
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
        case 'selectPlugin':
            await selectPluginHandler.onEvent({ data, manifest, platformInfo, platformName, platform, listButtonItemId });
            break;
        case 'pluginConfigurePage':
            if (data.body.button.type === 'submit') {
                await pluginConfigurePageSubmitHandler.onEvent({ data, manifest, platformInfo, platformName, platform });
            }
            break;
        case 'installedPluginListPage':
            if (data.body.button.type === 'submit') {
                await pluginMarketListPageHandler.onEvent({ data, manifest, platformInfo, platformName, platform });
            }
            break;
        case 'pluginDetailsSettingPage':
            if (data.body.button.type === 'submit') {
                await pluginDetailsSettingPageHandler.onEvent({ data, manifest, platformInfo, platformName, platform });
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
    // plugin configure buttons
    const isPlugin = !!data.body.button?.formData?.pluginId;
    if (data.body.button.type != 'submit' && isPlugin) {
        if (data.body.button.formData.isFromAdmin) {
            await pluginAdminConfigButtonsHandler.onEvent({ data, manifest, platformInfo, platformName, platform, buttonId: listButtonActionId });
        }
        else {
            await pluginConfigButtonsHandler.onEvent({ data, buttonId: listButtonActionId, manifest, platformInfo, platformName, platform });
        }
    }
    responseMessage(data.requestId, { data: 'ok' });
}

exports.onEvent = onEvent;
