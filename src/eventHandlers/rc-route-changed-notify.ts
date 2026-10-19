import { trackPage } from '../lib/analytics';
import userCore from '../core/user';
import calldownPage from '../components/calldownPage';
import appointmentsPage from '../components/appointmentsPage/appointmentsPage';
import { getManifest } from '../service/manifestService';
import { getPlatformInfo } from '../service/platformService';

type UnknownRecord = Record<string, any>;

type EventOptions = {
  data: {
    path: string;
  };
};

function getWidgetFrameWindow(): Window {
  return document.querySelector<HTMLIFrameElement>('#rc-widget-adapter-frame')!.contentWindow!;
}

export async function onEvent({ data }: EventOptions): Promise<void> {
  const { crmAuthed } = await chrome.storage.local.get({ crmAuthed: false }) as { crmAuthed: boolean };
  const manifest = await getManifest() as UnknownRecord;
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
    // Force Call Back tab to default to All when user navigates back to it from other tabs
    if (data.path === '/customizedTabs/calldownPage') {
      try {
        const { userSettings } = await chrome.storage.local.get('userSettings') as { userSettings: UnknownRecord };
        const { rcUnifiedCrmExtJwt } = await chrome.storage.local.get('rcUnifiedCrmExtJwt') as { rcUnifiedCrmExtJwt?: string };
        if (rcUnifiedCrmExtJwt && crmAuthed) {
          const refreshedCalldown = await calldownPage.getCalldownPageWithRecords({
            manifest,
            filterStatus: 'All',
            userSettings,
          });
          getWidgetFrameWindow().postMessage({
            type: 'rc-adapter-register-customized-page',
            page: refreshedCalldown,
          }, '*');
        } else {
          // CRM is disconnected, hide call back page if it was enabled
          if (userCore.getShowCalldownTabSetting(userSettings).value) {
            const emptyCalldownPage = calldownPage.getCalldownPageRender();
            emptyCalldownPage.hidden = true; // Hide the tab when CRM is disconnected
            emptyCalldownPage.unreadCount = 0;
            getWidgetFrameWindow().postMessage({
              type: 'rc-adapter-register-customized-page',
              page: emptyCalldownPage,
            }, '*');
          }
        }
      } catch (e) { void e; /* ignore */ }
    }
    if (data.path === '/customizedTabs/appointmentsPage') {
      window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
      try {
        const { rcUnifiedCrmExtJwt } = await chrome.storage.local.get('rcUnifiedCrmExtJwt') as { rcUnifiedCrmExtJwt?: string };
        if (rcUnifiedCrmExtJwt && crmAuthed) {
          const { userSettings } = await chrome.storage.local.get('userSettings') as { userSettings: UnknownRecord };
          const platformInfo = await getPlatformInfo();
          const platformName = platformInfo?.platformName ?? '';
          const apptCfg = manifest?.platforms?.[platformName]?.page?.appointment ?? {};
          if (!apptCfg.supported || !userCore.getShowAppointmentsTabSetting(userSettings).value) {
            return;
          }
          const refreshedAppointments = await appointmentsPage.getAppointmentsPageWithRecords({
            manifest,
            jwtToken: rcUnifiedCrmExtJwt,
            tab: 'upcoming',
            searchWithFilters: { search: '', filter: 'All' },
            forceSync: false,
            userSettings,
          });
          getWidgetFrameWindow().postMessage({
            type: 'rc-adapter-register-customized-page',
            page: refreshedAppointments,
          }, '*');
        }
      } catch (e) { void e; /* ignore */ }
      finally {
        window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
      }
    }
  }
  // user setting page needs a refresh mechanism to make sure user settings are up to date
  if (data.path === '/settings' && crmAuthed) {
    const nowDate = new Date();
    const { lastUserSettingSyncDate } = await chrome.storage.local.get({ lastUserSettingSyncDate: new Date() }) as { lastUserSettingSyncDate: any };
    if ((nowDate as any) - lastUserSettingSyncDate > 60000) {
      await userCore.refreshUserSettings({});
      await chrome.storage.local.set({ lastUserSettingSyncDate: new Date() });
    }
  }
}

export default {
  onEvent,
};
