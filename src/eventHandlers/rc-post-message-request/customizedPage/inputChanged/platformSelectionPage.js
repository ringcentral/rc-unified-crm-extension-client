import { createDebounceHandler } from '../../../../lib/util';
import platformSelectionPage from '../../../../components/platformSelectionPage';
import { getPlatformList } from '../../../../service/manifestService';

const debouncePlatformSearch = createDebounceHandler('platformSearch');

async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    const platformList = await getPlatformList();
    //Debounce search operations
    debouncePlatformSearch(data.body.formData.platformSearch.search, async (request) => {
        const updatedPlatformSelectionPageRender = platformSelectionPage.getPlatformSelectionPageRender({
            platformList,
            searchWord: data.body.formData.platformSearch.search,
            selectedPlatform: data.body.formData.platforms,
            filter: data.body.formData.platformSearch.filter
        });
        document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
            type: 'rc-adapter-register-customized-page',
            page: updatedPlatformSelectionPageRender
        });
    });
}

exports.onEvent = onEvent;