import { t } from '../../i18n';

type UnknownRecord = Record<string, any>;

type ExtensionAdoptionStats = {
    installedCount: number;
    connectedCount: number;
    lastActiveAt: string | null;
};

type ExtensionAdoptionPageProps = {
    // null = connector server does not expose the stats route (older @app-connect/core) or the request failed
    stats: ExtensionAdoptionStats | null;
    // null = RingCentral directory could not be loaded; total shows N/A
    rcExtensions: UnknownRecord[] | null;
};

const METRIC_BACKGROUND_COLOR = '#a0a2a91f';

function formatPercentage(numerator: number, denominator: number | null): string {
    if (!denominator || denominator <= 0) {
        return t('pages.extensionAdoption.notAvailable');
    }
    return `${Math.round((numerator / denominator) * 100)}%`;
}

function formatLastActiveAt(lastActiveAt: string | null): string | null {
    if (!lastActiveAt) {
        return null;
    }
    const date = new Date(lastActiveAt);
    if (Number.isNaN(date.getTime())) {
        return null;
    }
    return date.toLocaleString();
}

function getExtensionAdoptionPageRender({ stats, rcExtensions }: ExtensionAdoptionPageProps): UnknownRecord {
    const page: UnknownRecord = {
        id: 'extensionAdoptionPage',
        title: t('pages.admin.extensionAdoption'),
        type: 'page',
        schema: {
            type: 'object',
            properties: {},
        },
        uiSchema: {},
        formData: {},
    };

    if (!stats) {
        page.schema.properties.unsupported = {
            type: 'string',
            description: t('pages.extensionAdoption.unsupported'),
        };
        page.uiSchema.unsupported = {
            'ui:field': 'admonition',
            'ui:severity': 'warning',
        };
        return page;
    }

    const totalUsers = rcExtensions ? rcExtensions.length : null;
    const activatedPercentage = formatPercentage(stats.installedCount, totalUsers);
    const connectedPercentage = formatPercentage(stats.connectedCount, stats.installedCount);

    page.schema.properties.summaryTitle = {
        type: 'string',
        description: t('pages.extensionAdoption.summaryTitle'),
    };
    page.schema.properties.adoptionSummary = {
        type: 'string',
        oneOf: [
            {
                const: 'rcUsers',
                value: totalUsers === null ? t('pages.extensionAdoption.notAvailable') : totalUsers.toString(),
                title: t('pages.extensionAdoption.rcUsers'),
                backgroundColor: METRIC_BACKGROUND_COLOR,
            },
            {
                const: 'installedCount',
                value: stats.installedCount.toString(),
                title: t('pages.extensionAdoption.activated'),
                backgroundColor: METRIC_BACKGROUND_COLOR,
            },
            {
                const: 'connectedCount',
                value: stats.connectedCount.toString(),
                title: t('pages.extensionAdoption.connected'),
                backgroundColor: METRIC_BACKGROUND_COLOR,
            },
        ],
    };
    page.schema.properties.activatedShare = {
        type: 'string',
        description: t('pages.extensionAdoption.activatedShare', { percent: activatedPercentage }),
    };
    page.schema.properties.connectedShare = {
        type: 'string',
        description: t('pages.extensionAdoption.connectedShare', { percent: connectedPercentage }),
    };
    const lastActiveAt = formatLastActiveAt(stats.lastActiveAt);
    if (lastActiveAt) {
        page.schema.properties.lastActiveAt = {
            type: 'string',
            description: t('pages.extensionAdoption.lastActive', { time: lastActiveAt }),
        };
    }

    page.uiSchema = {
        summaryTitle: {
            'ui:field': 'typography',
            'ui:variant': 'body1',
        },
        adoptionSummary: {
            'ui:field': 'list',
            'ui:itemType': 'metric',
            'ui:itemWidth': '48%',
            'ui:itemHeight': '100px',
            'ui:showSelected': false,
            'ui:readonly': true,
        },
        activatedShare: {
            'ui:field': 'typography',
            'ui:variant': 'body2',
        },
        connectedShare: {
            'ui:field': 'typography',
            'ui:variant': 'body2',
        },
        ...(lastActiveAt ? {
            lastActiveAt: {
                'ui:field': 'typography',
                'ui:variant': 'caption',
            },
        } : {}),
    };
    return page;
}

export { getExtensionAdoptionPageRender, formatPercentage };
export default {
    getExtensionAdoptionPageRender,
    formatPercentage,
};
