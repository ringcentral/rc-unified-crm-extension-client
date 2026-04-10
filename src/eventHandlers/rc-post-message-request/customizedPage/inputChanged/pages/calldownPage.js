import { createDebounceHandler, responseMessage } from '../../../../../lib/util';
import calldownPage from '../../../../../components/calldownPage';

const debounceCalldownSearch = createDebounceHandler('calldownSearch', 300); // Standard delay like other pages 

async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    const { userSettings } = await chrome.storage.local.get({ userSettings: null });
    // Check if this is a search input change (requires debouncing)
    if (data.body.keys && data.body.keys.some(k => k === 'searchWithFilters')) {
        // Store current search and filter values to compare what actually changed
        const currentSearch = data.body.formData.searchWithFilters?.search || '';
        const currentFilter = data.body.formData.searchWithFilters?.filter || 'All';

        // Get previous values (if any) to detect what changed
        const { calldownLastState = { search: '', filter: 'All' } } = await chrome.storage.local.get('calldownLastState');

        const searchChanged = currentSearch !== calldownLastState.search;
        const filterChanged = currentFilter !== calldownLastState.filter;

        // If only search changed (typing), use debounce without spinner
        if (searchChanged && !filterChanged) {
            // Debounce search input to prevent characters from jumping/missing
            debounceCalldownSearch(data.requestId, async (request) => {
                // Get fresh form data at execution time to prevent stale data
                const updated = await calldownPage.getCalldownPageWithRecords({
                    manifest,
                    searchWithFilters: data.body.formData.searchWithFilters ?? {},
                    // fallback for legacy
                    filterName: data.body.formData.filterName ?? '',
                    filterStatus: data.body.formData.filterStatus ?? 'All',
                    userSettings
                });
                document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-register-customized-page',
                    page: updated
                });

                // Update state only after successful search completion
                await chrome.storage.local.set({
                    calldownLastState: {
                        search: currentSearch,
                        filter: currentFilter
                    }
                });

                responseMessage(request, { data: 'ok' });
            });
        } else {
            // Filter changed or initial load - immediate execution with spinner
            try {
                if (filterChanged) {
                    window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
                }

                // Update state immediately for filter changes
                await chrome.storage.local.set({
                    calldownLastState: {
                        search: currentSearch,
                        filter: currentFilter
                    }
                });

                const updated = await calldownPage.getCalldownPageWithRecords({
                    manifest,
                    searchWithFilters: data.body.formData.searchWithFilters ?? {},
                    // fallback for legacy
                    filterName: data.body.formData.filterName ?? '',
                    filterStatus: data.body.formData.filterStatus ?? 'All',
                    userSettings
                });
                document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-register-customized-page',
                    page: updated
                });
                responseMessage(data.requestId, { data: 'ok' });

                if (filterChanged) {
                    window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
                }
            } catch (error) {
                if (filterChanged) {
                    window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
                }
                console.error('Error in calldown operation:', error);
                responseMessage(data.requestId, { error: error.message });
            }
        }
    } else {
        // Other changes (row actions, etc.) - no debounce, no spinner
        const updated = await calldownPage.getCalldownPageWithRecords({
            manifest,
            searchWithFilters: data.body.formData.searchWithFilters ?? {},
            // fallback for legacy
            filterName: data.body.formData.filterName ?? '',
            filterStatus: data.body.formData.filterStatus ?? 'All',
            userSettings
        });
        document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
            type: 'rc-adapter-register-customized-page',
            page: updated
        });
        responseMessage(data.requestId, { data: 'ok' });
    }
}

exports.onEvent = onEvent;
