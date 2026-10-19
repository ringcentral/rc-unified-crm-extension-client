import accountDataPage from '../../../../../components/admin/accountDataPage';

type UnknownRecord = Record<string, any>;

function getWidgetFrameWindow(): Window {
    return document.querySelector<HTMLIFrameElement>('#rc-widget-adapter-frame')!.contentWindow!;
}

async function onEvent({ platform }: UnknownRecord): Promise<void> {
    window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
    try {
        const accountDataPageRender = accountDataPage.getAccountDataPageRender({ platform });
        getWidgetFrameWindow().postMessage({
            type: 'rc-adapter-register-customized-page',
            page: accountDataPageRender
        });
        getWidgetFrameWindow().postMessage({
            type: 'rc-adapter-navigate-to',
            path: `/customized/${accountDataPageRender.id}`,
        }, '*');
    }
    finally {
        window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
    }
}

export { onEvent };
export default { onEvent };
