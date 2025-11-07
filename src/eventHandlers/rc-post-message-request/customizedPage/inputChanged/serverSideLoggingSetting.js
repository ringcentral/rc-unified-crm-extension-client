import adminCore from '../../../../core/admin';
import serverSideLoggingPage from '../../../../components/admin/serverSideLoggingPage';

async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
    const serverSideLoggingSubscription = await adminCore.getServerSideLogging({ platform });
    const subscriptionLevel = serverSideLoggingSubscription.subscribed ? serverSideLoggingSubscription.subscriptionLevel : 'Disable';
    const additionalFieldValues = await adminCore.getServerSideLoggingAdditionalFieldValues({ platform });
    const { implementedInterfaces } = await chrome.storage.local.get({ implementedInterfaces: null });
    const enableUserMapping = implementedInterfaces?.getUserList;
    const serverSideLoggingSettingPageRender = serverSideLoggingPage.getServerSideLoggingSettingPageRender({
        subscriptionLevel: serverSideLoggingSubscription.subscribedByOtherAdmin ? serverSideLoggingSubscription.subscribedByOtherAdmin.setting.subscriptionLevel : subscriptionLevel,
        doNotLogNumbers: serverSideLoggingSubscription.subscribedByOtherAdmin ? serverSideLoggingSubscription.subscribedByOtherAdmin.setting.doNotLogNumbers : serverSideLoggingSubscription.doNotLogNumbers,
        loggingByAdmin: serverSideLoggingSubscription.subscribedByOtherAdmin ? serverSideLoggingSubscription.subscribedByOtherAdmin.setting.loggingByAdmin : serverSideLoggingSubscription.loggingByAdmin,
        subscribedByOtherAdmin: serverSideLoggingSubscription.subscribedByOtherAdmin,
        enableUserMapping,
        additionalFields: platform.serverSideLogging?.additionalFields ?? [],
        additionalFieldValues,
    });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-register-customized-page',
        page: serverSideLoggingSettingPageRender
    });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-navigate-to',
        path: `/customized/${serverSideLoggingSettingPageRender.id}`, // page id
    }, '*');
    window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
}

exports.onEvent = onEvent;