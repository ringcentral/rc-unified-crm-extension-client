import { t } from '../i18n';

type UnknownRecord = Record<string, any>;

function getPlatformSelectionPageRender({ platformList, searchWord = '', selectedPlatform = '', filter = 'All' }: UnknownRecord): UnknownRecord {
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
    if (filter !== t('common.labels.all')) {
        platformListToRender = platformListToRender.filter(um => um.meta === filter);
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
                    t('common.labels.all'),
                    t('common.labels.private'),
                    t('common.labels.sharedWithYou')
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
                filter: filter
            },
            platformList
        }
    }
}


export { getPlatformSelectionPageRender };
export default {
    getPlatformSelectionPageRender,
};
