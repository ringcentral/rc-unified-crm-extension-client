import appointmentsPage from '../../../components/appointmentsPage/appointmentsPage';

async function onEvent({ data, manifest }) {
  window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
  try {
    const { rcUnifiedCrmExtJwt } = await chrome.storage.local.get('rcUnifiedCrmExtJwt');
    const { appointmentsListState = { tab: 'upcoming', scope: 'mine' } } = await chrome.storage.local.get('appointmentsListState');
    const updated = await appointmentsPage.getAppointmentsPageWithRecords({
      manifest,
      jwtToken: rcUnifiedCrmExtJwt,
      tab: appointmentsListState.tab,
      scope: appointmentsListState.scope,
      forceSync: true,
    });
    document.querySelector('#rc-widget-adapter-frame').contentWindow.postMessage({
      type: 'rc-adapter-register-customized-page',
      page: updated,
    }, '*');
  } finally {
    window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
  }
}

exports.onEvent = onEvent;

