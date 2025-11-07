import logPage from '../../../../components/logPage';
import contactSearch from '../../../../core/customContactSearch';
import { responseMessage } from '../../../../lib/util';

async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    const updatedPage = logPage.getUpdatedLogPageRender({ manifest, logType: 'Message', platformName, updateData: data.body });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
      type: 'rc-adapter-update-messages-log-page',
      page: updatedPage
    }, '*');
    if (data.body.formData.contact === 'searchContact') {
      const contactSearchRender = contactSearch.getCustomContactSearch({ contactSearchAdapterButton: "contactSearchAdapterButtonMessageLog", contactPhoneNumber: data.body.formData?.contactPhoneNumber });
      document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-register-customized-page',
        page: contactSearchRender
      });
      document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-navigate-to',
        path: `/customized/${contactSearchRender.id}`,
      }, '*');
    }
    responseMessage(data.requestId, { data: 'ok' });
}

exports.onEvent = onEvent;