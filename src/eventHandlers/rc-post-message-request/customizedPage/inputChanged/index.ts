import c2dSchedulePageHandler from './pages/c2dSchedulePage';
import editUserMappingPageHandler from './pages/editUserMappingPage';
import userMappingPageHandler from './pages/userMappingPage';
import hostnameInputPageHandler from './pages/hostnameInputPage';
import platformSelectionPageHandler from './pages/platformSelectionPage';
import getMultiContactPopPromptPageHandler from './pages/getMultiContactPopPromptPage';
import calldownPageHandler from './pages/calldownPage';
import googleSheetsPageHandler from './pages/googleSheetsPage';
import contactSearchResultCallLogHandler from './pages/contactSearchResultCallLog';
import contactSearchResultMessageLogHandler from './pages/contactSearchResultMessageLog';
import reportPageHandler from './pages/reportPage';
import unloggedCallPageHandler from './pages/unloggedCallPage';
import developerSettingsPageHandler from './pages/developerSettingsPage';
import getErrorLogRecrodPageHandler from './pages/getErrorLogRecordPage';
import logRecordSubmissionPageHandler from './pages/logRecordSubmissionPage';
import adminGoogleSheetsPageHandler from './pages/adminGoogleSheetsPage';
import pluginAdminSettingsPageHandler from './pages/pluginAdminSettingsPage';
import managedAuthUserPageHandler from './pages/managedAuthUserPage';
import managedAuthUserEditPageHandler from './pages/managedAuthUserEditPage';

import generalSettingsHandler from './sections/generalSettings';
import managedSettingsHandler from './sections/managedSettings';
import appearanceHandler from './sections/appearance';
import clickToDialMatcherHandler from './sections/clickToDialMatcher';
import customizeTabsHandler from './sections/customizeTabs';
import widgetSettingsHandler from './sections/widgetSettings';
import notificationLevelHandler from './sections/notificationLevel';
import languageHandler from './sections/language';
import phoneNumberFormatHandler from './sections/phoneNumberFormat';
import clickToDialEmbedHandler from './sections/clickToDialEmbed';
import callAndSMSLoggingHandler from './sections/callAndSMSLogging';
import serverSideLoggingSettingHandler from './sections/serverSideLoggingSetting';
import contactSettingHandler from './sections/contactSetting';
import advancedFeaturesSettingHandler from './sections/advancedFeaturesSetting';
import customSettingsHandler from './sections/customSettings';
import callLogDetailsSettingHandler from './sections/callLogDetailsSetting';
import autoLogPreferencesHandler from './sections/autoLogPreferences';
import userMappingHandler from './sections/userMapping';
import googleSheetsAdminConfigHandler from './sections/googleSheetsAdminConfig';
import pluginsAdminConfigHandler from './sections/pluginsAdminConfig';
import installedPluginsHandler from './sections/installedPlugins';
import managedAuthenticationHandler from './sections/managedAuthentication';
import managedOAuthHandler from './sections/managedOAuth';
import managedAuthOrgHandler from './sections/managedAuthOrg';
import managedAuthUserHandler from './sections/managedAuthUser';

import pluginMarketListPageHandler from '../../pluginMarketListPage';
import selectPluginHandler from '../../custom-button-click/plugins/selectPlugin';
import appointmentsPageHandler from './appointmentsPage';
import appointmentPageHandler from './appointmentPage';

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
    getWidgetFrameWindow().postMessage({
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
        case 'logRecordSubmissionPage':
            await logRecordSubmissionPageHandler.onEvent({ data, manifest, platformInfo, platformName, platform });
            break;
        case 'adminGoogleSheetsPage':
            await adminGoogleSheetsPageHandler.onEvent({ data, manifest, platformInfo, platformName, platform });
            break;
        case 'pluginAdminSettingsPage':
            const pluginId = data.body?.formData?.section;
            await pluginAdminSettingsPageHandler.onEvent({ data, manifest, platformInfo, platformName, platform, pluginId });
            break;
        case 'managedAuthUserPage':
            await (managedAuthUserPageHandler as UnknownRecord).onEvent({ data, manifest, platformInfo, platformName, platform });
            break;
        case 'managedAuthUserEditPage':
            await (managedAuthUserEditPageHandler as UnknownRecord).onEvent({ data, manifest, platformInfo, platformName, platform });
            break;
        case 'installedPluginListPage':
            await selectPluginHandler.onEvent({ data, manifest, platformInfo, platformName, platform });
            break;
        case 'appointmentsPage':
            await (appointmentsPageHandler as UnknownRecord).onEvent({ data, manifest, platformInfo, platformName, platform });
            break;
        case 'appointmentCreatePage':
        case 'appointmentEditPage':
            await appointmentPageHandler.onEvent({ data, manifest, platformName });
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
        case 'plugins':
            switch (data.body.page.id) {
                case 'adminPage':
                    await installedPluginsHandler.onEvent({ data, manifest, platformInfo, platformName, platform });
                    break;
                case 'managedSettings':
                    await pluginsAdminConfigHandler.onEvent({ data, manifest, platformInfo, platformName, platform });
                    break;
            }
            break;
        case 'managedAuthentication':
            await managedAuthenticationHandler.onEvent({ data, manifest, platformInfo, platformName, platform });
            break;
        case 'managedOAuth':
            await (managedOAuthHandler as UnknownRecord).onEvent({ data, manifest, platformInfo, platformName, platform });
            break;
        case 'managedAuthOrg':
            await (managedAuthOrgHandler as UnknownRecord).onEvent({ data, manifest, platformInfo, platformName, platform });
            break;
        case 'managedAuthUser':
            await (managedAuthUserHandler as UnknownRecord).onEvent({ data, manifest, platformInfo, platformName, platform });
            break;
        case 'pluginMarket':
            await pluginMarketListPageHandler.onEvent({ data, manifest, platformInfo, platformName, platform });
            break;
        case 'appearance':
            await appearanceHandler.onEvent({ data, manifest, platformInfo, platformName, platform });
            break;
        case 'clickToDialMatcher':
            await clickToDialMatcherHandler.onEvent({ data, manifest, platformInfo, platformName, platform });
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
        case 'language':
            await languageHandler.onEvent({ data, manifest, platformInfo, platformName, platform });
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
        case 'googleSheetsAdminConfig':
            await googleSheetsAdminConfigHandler.onEvent({ data, manifest, platformInfo, platformName, platform });
            break;
        default:
            break;
    }
}

export { onEvent };
export default {
    onEvent,
};
