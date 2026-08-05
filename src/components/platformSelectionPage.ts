import { t } from '../i18n';

type UnknownRecord = Record<string, any>;

function getPlatformFilterLabels(): UnknownRecord {
    return {
        all: t('common.labels.all'),
        private: t('common.labels.private'),
        shared: t('common.labels.sharedWithYou'),
    };
}

function normalizePlatformFilter(filter: unknown): string {
    const labels = getPlatformFilterLabels();
    switch (filter) {
        case undefined:
        case null:
        case '':
        case 'All':
            return labels.all;
        case 'Private':
            return labels.private;
        case 'Shared':
        case 'Shared With You':
            return labels.shared;
        default:
            return String(filter);
    }
}

function getPlatformSelectionPageRender({ platformList, searchWord = '', selectedPlatform = '', filter = null }: UnknownRecord): UnknownRecord {
    const filterLabels = getPlatformFilterLabels();
    const filterValue = normalizePlatformFilter(filter);
    let platformListToRender = [];

    // put the new element as the last element that has the same developer
    // if there's no same developer, put it at the last of the array
    for (const platform of platformList) {
        let meta = '';
        switch (platform.access) {
            case 'public':
                meta = '';
                break;
            case 'shared':
                meta = t('common.labels.sharedWithYou');
                break;
            case 'private':
                meta = t('common.labels.private');
                break;
        }
        const newPlatform = {
            const: `${platform.id}=${platform.access}`,
            title: platform.displayName ?? platform.name,
            icon: platform.iconUrl ? platform.iconUrl : 'https://raw.githubusercontent.com/ringcentral/rc-unified-crm-extension-client/refs/heads/main/public/images/logo48.png',
            description: `by ${platform.developer.name}`,
            meta: meta,
            actions:[
                {
                    id: 'selectPlatform',
                    title: t('common.buttons.connect'),
                    icon: 'connect'
                }
            ]
        };
        platformListToRender.push(newPlatform);
    }
    if (searchWord) {
        platformListToRender = platformListToRender.filter(um => um.title.toLowerCase().includes(searchWord.toLowerCase()) || um.description.toLowerCase().includes(searchWord.toLowerCase()));
    }
    if (filterValue !== filterLabels.all) {
        platformListToRender = platformListToRender.filter(um => um.meta === filterValue);
    }
    return {
        id: 'platformSelectionPage',
        title: t('pages.platformSelection.title'),
        type: 'page',
        // hideBackButton: true,
        schema: {
            type: 'object',
            properties: {
                platformSearch: {
                    type: 'object',
                    properties: {
                        search: {
                            type: 'string',
                            title: t('common.labels.search')
                        },
                        filter: {
                            type: 'string',
                            title: t('common.labels.filter')
                        }
                    }
                },
                platforms: {
                    type: 'string',
                    title: 'Platforms',
                    oneOf: platformListToRender
                }
            }
        },
        uiSchema: {
            platformSearch: {
                "ui:field": "search",
                "ui:placeholder": t('pages.platformSelection.searchPlaceholder'),
                "ui:filters": [
                    filterLabels.all,
                    filterLabels.private,
                    filterLabels.shared
                ]
            },
            platforms: {
                "ui:field": "list",
                "ui:showIconAsAvatar": false
            }
        },
        formData: {
            platforms: selectedPlatform,
            platformSearch: {
                search: searchWord,
                filter: filterValue
            },
            platformList
        }
    }
}


export { getPlatformSelectionPageRender, normalizePlatformFilter };
export default {
    getPlatformSelectionPageRender,
};
