import { trackPage } from '../lib/analytics';
import userCore from '../core/user';
import calldownPage from '../components/calldownPage';
import appointmentsPage from '../components/appointmentsPage/appointmentsPage';
import { getManifest } from '../service/manifestService';

async function onEvent({ data }) {
    const { crmAuthed } = await chrome.storage.local.get({ crmAuthed: false });
    const manifest = await getManifest();
    await chrome.storage.local.set({ appConnectCurrentPath: data.path });
    if (!data.path.startsWith('/log/message') && !data.path.startsWith('/conversations/')) {
      await chrome.storage.local.set({ autoPopupMainConverastionId: null });
    }
    if (data.path !== '/') {
      trackPage(data.path);
    }
    if (data.path) {
      if (data.path.startsWith('/conversations/') || data.path.startsWith('/composeText')) {
        window.postMessage({ type: 'rc-expandable-call-note-terminate' }, '*');
      }
      // Force Call-down tab to default to All when user navigates back to it from other tabs
      if (data.path === '/customizedTabs/calldownPage') {
        try {
          const { userSettings } = await chrome.storage.local.get('userSettings');
          const { rcUnifiedCrmExtJwt } = await chrome.storage.local.get('rcUnifiedCrmExtJwt');
          if (rcUnifiedCrmExtJwt && crmAuthed) {
            const refreshedCalldown = await calldownPage.getCalldownPageWithRecords({
              manifest,
              jwtToken: rcUnifiedCrmExtJwt,
              filterStatus: 'All',
              userSettings
            });
            document.querySelector('#rc-widget-adapter-frame').contentWindow.postMessage({
              type: 'rc-adapter-register-customized-page',
              page: refreshedCalldown
            }, '*');
          } else {
            // CRM is disconnected, hide call-down page if it was enabled
            if (userCore.getShowCalldownTabSetting(userSettings).value) {
              const emptyCalldownPage = calldownPage.getCalldownPageRender();
              emptyCalldownPage.hidden = true; // Hide the tab when CRM is disconnected
              emptyCalldownPage.unreadCount = 0;
              document.querySelector('#rc-widget-adapter-frame').contentWindow.postMessage({
                type: 'rc-adapter-register-customized-page',
                page: emptyCalldownPage
              }, '*');
            }
          }
        } catch (e) { /* ignore */ }
      }
      if (data.path === '/customizedTabs/appointmentsPage') {
        try {
          const { rcUnifiedCrmExtJwt } = await chrome.storage.local.get('rcUnifiedCrmExtJwt');
          if (rcUnifiedCrmExtJwt && crmAuthed) {
            const refreshedAppointments = await appointmentsPage.getAppointmentsPageWithRecords({
              manifest,
              jwtToken: rcUnifiedCrmExtJwt,
              tab: 'upcoming',
              searchWithFilters: { search: '', filter: 'All' },
              forceSync: false
            });
            document.querySelector('#rc-widget-adapter-frame').contentWindow.postMessage({
              type: 'rc-adapter-register-customized-page',
              page: refreshedAppointments
            }, '*');
          }
        } catch (e) { /* ignore */ }
      }
    }
    // user setting page needs a refresh mechanism to make sure user settings are up to date
    if (data.path === '/settings' && crmAuthed) {
      const nowDate = new Date();
      const { lastUserSettingSyncDate } = await chrome.storage.local.get({ lastUserSettingSyncDate: new Date() });
      if (nowDate - lastUserSettingSyncDate > 60000) {
        await userCore.refreshUserSettings({});
        await chrome.storage.local.set({ lastUserSettingSyncDate: new Date() });
      }
    }
}

exports.onEvent = onEvent;