import { createDebounceHandler } from '../../../../../lib/util';
import platformSelectionPage from '../../../../../components/platformSelectionPage';
import { getPlatformList } from '../../../../../service/manifestService';

type UnknownRecord = Record<string, any>;

type EventOptions = {
  data: UnknownRecord;
  manifest?: UnknownRecord;
  platformInfo?: UnknownRecord;
  platformName?: string;
  platform?: UnknownRecord;
};

function getWidgetFrameWindow(): Window {
  return document.querySelector<HTMLIFrameElement>('#rc-widget-adapter-frame')!.contentWindow!;
}

const debouncePlatformSearch = createDebounceHandler('platformSearch');

export async function onEvent({ data, manifest, platformInfo, platformName, platform }: EventOptions): Promise<void> {
  void manifest;
  void platformInfo;
  void platformName;
  void platform;
  const platformList = await getPlatformList();
  //Debounce search operations
  debouncePlatformSearch(data.body.formData.platformSearch.search, async (request: unknown) => {
    void request;
    const updatedPlatformSelectionPageRender = platformSelectionPage.getPlatformSelectionPageRender({
      platformList,
      searchWord: data.body.formData.platformSearch.search,
      selectedPlatform: data.body.formData.platforms,
      filter: data.body.formData.platformSearch.filter,
    });
    getWidgetFrameWindow().postMessage({
      type: 'rc-adapter-register-customized-page',
      page: updatedPlatformSelectionPageRender,
    });
  });
}

export default {
  onEvent,
};
