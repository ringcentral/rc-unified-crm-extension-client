import { getRcAccessToken, getRcInfo } from '../../../../../lib/util';
import { RcAPI } from '../../../../../lib/rcAPI';
import contactCore from '../../../../../core/contact';
import logPage from '../../../../../components/logPage';
import userCore from '../../../../../core/user';
import adminCore from '../../../../../core/admin';
import reportPage from '../../../../../components/reportPage/reportPage';
import moment from 'moment';
import 'moment-timezone';

type UnknownRecord = Record<string, any>;

type EventOptions = {
  data: UnknownRecord;
  manifest: UnknownRecord;
  platformInfo?: UnknownRecord;
  platformName?: string;
  platform?: UnknownRecord;
};

function getWidgetFrameWindow(): Window {
  return document.querySelector<HTMLIFrameElement>('#rc-widget-adapter-frame')!.contentWindow!;
}

export async function onEvent({ data, manifest, platformInfo, platformName, platform }: EventOptions): Promise<void> {
  void platformInfo;
  void platform;
  const { isAdmin } = await chrome.storage.local.get('isAdmin') as { isAdmin?: boolean };
  const { userSettings } = await chrome.storage.local.get({ userSettings: null }) as { userSettings?: UnknownRecord | null };
  let rcExtensions: UnknownRecord[] | undefined;
  if (isAdmin) {
    const rcAPI = new RcAPI();
    rcExtensions = await rcAPI.getRcExtensionList({ rcAccessToken: getRcAccessToken() });
    if (data.body.keys.some((k: string) => k === 'rcExtensionList')) {
      if (!rcExtensions?.some(rcExtension => rcExtension.id == data.body.formData.rcExtensionList) && data.body.formData.rcExtensionList !== 'me') {
        return;
      }
    }
  }
  window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
  if (data.body.formData.unloggedCallSummary === 'unloggedCallCount') {
    const unloggedCalls = data.body.formData.unloggedCalls;
    if (unloggedCalls?.length > 0) {
      const foundContacts: UnknownRecord[][] = [];
      for (const c of unloggedCalls) {
        const contactNumber = c.direction === 'Inbound' ? c.from.phoneNumber : c.to.phoneNumber;
        const foundContact = foundContacts.find(cc => cc.some(contact => contact.phoneNumber === contactNumber));
        if (foundContact) {
          c.matched = true;
          c.contactInfo = foundContact;
          c.phoneNumber = contactNumber;
          continue;
        }
        const { matched, contactInfo } = await contactCore.getContact({ serverUrl: manifest.serverUrl, phoneNumber: contactNumber, platformName });
        if (matched) {
          foundContacts.push(contactInfo);
        }
        c.matched = matched;
        c.contactInfo = contactInfo;
        c.phoneNumber = contactNumber;
      }
      const unloggedCallPageRender = logPage.getUnloggedCallPageRender({ unloggedCalls });
      getWidgetFrameWindow().postMessage({
        type: 'rc-adapter-register-customized-page',
        page: unloggedCallPageRender,
      });
      getWidgetFrameWindow().postMessage({
        type: 'rc-adapter-navigate-to',
        path: `/customized/${unloggedCallPageRender.id}`, // page id
      }, '*');
      await chrome.storage.local.set({ unloggedCallPageDataCache: unloggedCalls });
    }
  } else if (userCore.getShowUserReportTabSetting(userSettings).value) {
    let userReportStats: UnknownRecord | undefined;
    let adminReportStats: UnknownRecord | undefined;
    const { rcUnifiedCrmExtJwt } = await chrome.storage.local.get('rcUnifiedCrmExtJwt') as { rcUnifiedCrmExtJwt?: string };
    const rcInfoData = await getRcInfo() as UnknownRecord;
    let timeFrom = moment(data.body.formData.startDate).toISOString();
    let timeTo = moment(data.body.formData.endDate).toISOString();
    const timezone = rcInfoData.value.cachedData.accountInfo.regionalSettings.timezone.name;
    // set to ISO string with regards to timezone
    switch (data.body.formData.dateRangeEnums) {
      case 'Last 24 hours':
        timeFrom = moment().tz(timezone).subtract(24, 'hours').toISOString();
        timeTo = moment().tz(timezone).subtract(1, 'minutes').toISOString();
        break;
      case 'Last 7 days':
        timeFrom = moment().tz(timezone).subtract(7, 'days').toISOString();
        timeTo = moment().tz(timezone).subtract(1, 'minutes').toISOString();
        break;
      case 'Last 30 days':
        timeFrom = moment().tz(timezone).subtract(30, 'days').toISOString();
        timeTo = moment().tz(timezone).subtract(1, 'minutes').toISOString();
        break;
      case 'Select date range...':
        if (data.body.formData.startDate && data.body.formData.endDate && data.body.formData.startDate < data.body.formData.endDate) {
          timeFrom = moment(data.body.formData.startDate).set('hour', 0).set('minute', 0).set('second', 0).tz(timezone).toISOString();
          timeTo = moment(data.body.formData.endDate).set('hour', 23).set('minute', 59).set('second', 59).tz(timezone).toISOString();
        } else {
          window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
          return;
        }
        break;
    }
    const currentTab = data.body.formData.tab || 'userReportTab';
    const isSkipDataFetch = data?.body?.keys?.some((k: string) => k === 'itemKeyEnums');
    if (isSkipDataFetch) {
      adminReportStats = data.body.formData.companyStats;
    } else {
      switch (currentTab) {
        case 'companyReportTab':
          adminReportStats = await adminCore.getAdminReportStats({
            serverUrl: manifest.serverUrl,
            jwtToken: rcUnifiedCrmExtJwt,
            timezone,
            timeFrom,
            timeTo,
            groupBy: data.body.formData.groupKeyEnums,
          });
          adminReportStats.dateRange = data.body.formData.dateRangeEnums;
          adminReportStats.startDate = data.body.formData.startDate;
          adminReportStats.endDate = data.body.formData.endDate;
          break;
        case 'userReportTab':
          switch (data.body.formData.rcExtensionList) {
            case 'me':
              userReportStats = await userCore.getUserReportStats({
                dateRange: data.body.formData.dateRangeEnums || 'Last 24 hours',
                customStartDate: timeFrom,
                customEndDate: timeTo,
              }) as UnknownRecord;
              break;
            default:
              userReportStats = await adminCore.getUserExtensionReportStats({
                serverUrl: manifest.serverUrl,
                jwtToken: rcUnifiedCrmExtJwt,
                timezone,
                timeFrom,
                timeTo,
                rcExtensionId: data.body.formData.rcExtensionList ?? '~',
              });
              break;
          }
          userReportStats.dateRange = data.body.formData.dateRangeEnums;
          userReportStats.startDate = data.body.formData.startDate;
          userReportStats.endDate = data.body.formData.endDate;
          break;
      }
    }
    const { isAdmin: latestIsAdmin } = await chrome.storage.local.get('isAdmin') as { isAdmin?: boolean };
    const reportPageRender = reportPage.getReportsPageRender(
      {
        selectedTab: currentTab,
        selectedRcExtension: data.body.formData.rcExtensionList,
        isAdmin: latestIsAdmin,
        userStats: userReportStats,
        companyStats: adminReportStats,
        selectedGroupKey: adminReportStats?.groupedBy,
        groupKeys: adminReportStats?.groupKeys,
        selectedItemKey: data.body.formData.itemKeyEnums,
        itemKeys: adminReportStats?.itemKeys,
        userSettings,
        rcExtensions,
      });
    getWidgetFrameWindow().postMessage({
      type: 'rc-adapter-register-customized-page',
      page: reportPageRender,
    });
    getWidgetFrameWindow().postMessage({
      type: 'rc-adapter-navigate-to',
      path: `/customizedTabs/${reportPageRender.id}`, // page id
    }, '*');
  }
  window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
}

export default {
  onEvent,
};
