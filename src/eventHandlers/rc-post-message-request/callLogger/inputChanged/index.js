import logCore from '../../../../core/log';
import logPage from '../../../../components/logPage';
import contactSearch from '../../../../core/customContactSearch';
import { responseMessage } from '../../../../lib/util';

async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    await logCore.cacheCallNote({
      sessionId: data.body.call.sessionId,
      note: data.body.formData.note ?? ''
    });
    const page = logPage.getUpdatedLogPageRender({ manifest, platformName, logType: 'Call', updateData: data.body });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
      type: 'rc-adapter-update-call-log-page',
      page
    }, '*');
    if (data.body.formData.contact === 'searchContact') {
      const contactSearchRender = contactSearch.getCustomContactSearch({ contactSearchAdapterButton: "contactSearchAdapterButtonCallLog", contactPhoneNumber: data.body.formData?.contactPhoneNumber });
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