import accountDataPage from '../../../../../components/admin/accountDataPage';

type UnknownRecord = Record<string, any>;

function getWidgetFrameWindow(): Window {
    return document.querySelector<HTMLIFrameElement>('#rc-widget-adapter-frame')!.contentWindow!;
}

async function onEvent({ platform }: UnknownRecord): Promise<void> {
    const accountDataPageRender = accountDataPage.getAccountDataPageRender({ platform });
    getWidgetFrameWindow().postMessage({
        type: 'rc-adapter-register-customized-page',
        page: accountDataPageRender
    });
    getWidgetFrameWindow().postMessage({
        type: 'rc-adapter-navigate-to',
        path: `/customized/${accountDataPageRender.id}`, // page id
    }, '*');
}

export { onEvent };
export default {
    onEvent,
};
