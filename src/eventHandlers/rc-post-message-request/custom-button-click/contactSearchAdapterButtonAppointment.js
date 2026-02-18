import contactSearch from '../../../core/customContactSearch';

async function onEvent({ data, manifest, platform }) {
  window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
  try {
    const contactNameToBeSearch = data.body.button.formData.contactNameToSearch;
    const res = await contactSearch.getCustomContactSearchData({
      serverUrl: manifest.serverUrl,
      platform,
      contactSearch: contactNameToBeSearch,
      pageId: 'contactSearchResultAppointment',
      contactPhoneNumber: '',
    });
    if (!res) {
      return;
    }
    document.querySelector('#rc-widget-adapter-frame').contentWindow.postMessage({
      type: 'rc-adapter-register-customized-page',
      page: res,
    }, '*');
    document.querySelector('#rc-widget-adapter-frame').contentWindow.postMessage({
      type: 'rc-adapter-navigate-to',
      path: `/customized/${res.id}`,
    }, '*');
  } finally {
    window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
  }
}

exports.onEvent = onEvent;

