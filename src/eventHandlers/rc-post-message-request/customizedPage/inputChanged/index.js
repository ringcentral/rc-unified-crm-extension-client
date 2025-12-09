import c2dSchedulePageHandler from './c2dSchedulePage';
import editUserMappingPageHandler from './editUserMappingPage';
import userMappingPageHandler from './userMappingPage';
import hostnameInputPageHandler from './hostnameInputPage';
import platformSelectionPageHandler from './platformSelectionPage';
import getMultiContactPopPromptPageHandler from './getMultiContactPopPromptPage';
import calldownPageHandler from './calldownPage';
import googleSheetsPageHandler from './googleSheetsPage';
import contactSearchResultCallLogHandler from './contactSearchResultCallLog';
import contactSearchResultMessageLogHandler from './contactSearchResultMessageLog';
import reportPageHandler from './reportPage';
import unloggedCallPageHandler from './unloggedCallPage';
import generalSettingsHandler from './generalSettings';
import managedSettingsHandler from './managedSettings';
import appearanceHandler from './appearance';
import customizeTabsHandler from './customizeTabs';
import widgetSettingsHandler from './widgetSettings';
import notificationLevelHandler from './notificationLevel';
import phoneNumberFormatHandler from './phoneNumberFormat';
import clickToDialEmbedHandler from './clickToDialEmbed';
import callAndSMSLoggingHandler from './callAndSMSLogging';
import serverSideLoggingSettingHandler from './serverSideLoggingSetting';
import contactSettingHandler from './contactSetting';
import advancedFeaturesSettingHandler from './advancedFeaturesSetting';
import customSettingsHandler from './customSettings';
import callLogDetailsSettingHandler from './callLogDetailsSetting';
import autoLogPreferencesHandler from './autoLogPreferences';
import userMappingHandler from './userMapping';
import developerSettingsPageHandler from './developerSettingsPage';
import getErrorLogRecrodPageHandler from './getErrorLogRecordPage';

async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-post-message-response',
        responseId: data.requestId,
        response: { data: 'ok' },
    }, '*');

    // Input changed for customized pages
    switch (data.body.page.id) {
        case 'c2dSchedulePage':
            await c2dSchedulePageHandler.onEvent({ data, manifest, platformInfo, platformName, platform });
            break;
        case 'editUserMappingPage':
            await editUserMappingPageHandler.onEvent({ data, manifest, platformInfo, platformName, platform });
            break;
        case 'userMappingPage':
            await userMappingPageHandler.onEvent({ data, manifest, platformInfo, platformName, platform });
            break;
        case 'hostnameInputPage':
            await hostnameInputPageHandler.onEvent({ data, manifest, platformInfo, platformName, platform });
            break;
        case 'platformSelectionPage':
            await platformSelectionPageHandler.onEvent({ data, manifest, platformInfo, platformName, platform });
            break;
        case 'getMultiContactPopPromptPage':
            await getMultiContactPopPromptPageHandler.onEvent({ data, manifest, platformInfo, platformName, platform });
            break;
        case 'calldownPage':
            await calldownPageHandler.onEvent({ data, manifest, platformInfo, platformName, platform });
            break;
        case 'googleSheetsPage':
            await googleSheetsPageHandler.onEvent({ data, manifest, platformInfo, platformName, platform });
            break;
        case 'contactSearchResultCallLog':
            await contactSearchResultCallLogHandler.onEvent({ data, manifest, platformInfo, platformName, platform });
            break;
        case 'contactSearchResultMessageLog':
            await contactSearchResultMessageLogHandler.onEvent({ data, manifest, platformInfo, platformName, platform });
            break;
        case 'reportPage':
            await reportPageHandler.onEvent({ data, manifest, platformInfo, platformName, platform });
            break;
        case 'unloggedCallPage':
            await unloggedCallPageHandler.onEvent({ data, manifest, platformInfo, platformName, platform });
            break;
        case 'developerSettingsPage':
            await developerSettingsPageHandler.onEvent({ data, manifest, platformInfo, platformName, platform });
            break;
        case 'errorLogRecordPage':
            await getErrorLogRecrodPageHandler.onEvent({ data, manifest, platformInfo, platformName, platform });
            break;
    }
    // Page render update from section change input
    switch (data.body?.formData?.section) {
        case 'generalSettings':
            await generalSettingsHandler.onEvent({ data, manifest, platformInfo, platformName, platform });
            break;
        case 'managedSettings':
            await managedSettingsHandler.onEvent({ data, manifest, platformInfo, platformName, platform });
            break;
        case 'appearance':
            await appearanceHandler.onEvent({ data, manifest, platformInfo, platformName, platform });
            break;
        case 'customizeTabs':
            await customizeTabsHandler.onEvent({ data, manifest, platformInfo, platformName, platform });
            break;
        case 'widgetSettings':
            await widgetSettingsHandler.onEvent({ data, manifest, platformInfo, platformName, platform });
            break;
        case 'notificationLevel':
            await notificationLevelHandler.onEvent({ data, manifest, platformInfo, platformName, platform });
            break;
        case 'phoneNumberFormat':
            await phoneNumberFormatHandler.onEvent({ data, manifest, platformInfo, platformName, platform });
            break;
        case 'clickToDialEmbed':
            await clickToDialEmbedHandler.onEvent({ data, manifest, platformInfo, platformName, platform });
            break;
        case 'callAndSMSLogging':
            await callAndSMSLoggingHandler.onEvent({ data, manifest, platformInfo, platformName, platform });
            break;
        case 'serverSideLoggingSetting':
            await serverSideLoggingSettingHandler.onEvent({ data, manifest, platformInfo, platformName, platform });
            break;
        case 'contactSetting':
            await contactSettingHandler.onEvent({ data, manifest, platformInfo, platformName, platform });
            break;
        case 'advancedFeaturesSetting':
            await advancedFeaturesSettingHandler.onEvent({ data, manifest, platformInfo, platformName, platform });
            break;
        case 'customSettings':
            await customSettingsHandler.onEvent({ data, manifest, platformInfo, platformName, platform });
            break;
        case 'callLogDetailsSetting':
            await callLogDetailsSettingHandler.onEvent({ data, manifest, platformInfo, platformName, platform });
            break;
        case 'autoLogPreferences':
            await autoLogPreferencesHandler.onEvent({ data, manifest, platformInfo, platformName, platform });
            break;
        case 'userMapping':
            await userMappingHandler.onEvent({ data, manifest, platformInfo, platformName, platform });
            break;
        default:
            break;
    }
}

exports.onEvent = onEvent;