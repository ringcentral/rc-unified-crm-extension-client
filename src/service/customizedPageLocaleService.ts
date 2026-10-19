import userCore from '../core/user';
import { t } from '../i18n';

type UnknownRecord = Record<string, any>;

function getAdapterFrame(): HTMLIFrameElement | null {
  return document.querySelector<HTMLIFrameElement>('#rc-widget-adapter-frame');
}

function getCustomizedPages(adapterFrame: HTMLIFrameElement): UnknownRecord[] {
  const widgetWindow = adapterFrame.contentWindow as (Window & { phone?: UnknownRecord }) | null;
  return widgetWindow?.phone?.thirdPartyService?.customizedPages ?? [];
}

function registerCustomizedPagePatch(adapterFrame: HTMLIFrameElement, page: UnknownRecord): void {
  adapterFrame.contentWindow?.postMessage({
    type: 'rc-adapter-register-customized-page',
    page,
  }, '*');
}

async function getUserSettings(userSettings?: UnknownRecord): Promise<UnknownRecord> {
  if (userSettings) {
    return userSettings;
  }
  const stored = await chrome.storage.local.get({ userSettings: {} });
  return stored.userSettings;
}

export async function refreshLocalizedCustomizedPageTitles(
  { userSettings }: { userSettings?: UnknownRecord } = {},
): Promise<void> {
  const adapterFrame = getAdapterFrame();
  if (!adapterFrame?.contentWindow) {
    return;
  }

  const customizedPages = getCustomizedPages(adapterFrame);
  if (!Array.isArray(customizedPages) || customizedPages.length === 0) {
    return;
  }

  const pageIds = new Set(customizedPages.map((page) => page?.id).filter(Boolean));
  const resolvedUserSettings = await getUserSettings(userSettings);
  const updates: UnknownRecord[] = [];

  if (pageIds.has('adminPage')) {
    updates.push({
      id: 'adminPage',
      type: 'tab',
      title: t('pages.admin.title'),
    });
  }

  if (pageIds.has('reportPage')) {
    updates.push({
      id: 'reportPage',
      type: 'tab',
      title: t('pages.reports.title'),
      hidden: !userCore.getShowUserReportTabSetting(resolvedUserSettings).value,
    });
  }

  if (pageIds.has('calldownPage')) {
    updates.push({
      id: 'calldownPage',
      type: 'tab',
      title: t('pages.calldown.title'),
      hidden: !userCore.getShowCalldownTabSetting(resolvedUserSettings).value,
    });
  }

  updates.forEach((page) => registerCustomizedPagePatch(adapterFrame, page));
}
