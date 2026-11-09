import axios from 'axios';

const names = ['rc-analytics-account-id', 'rc-analytics-extension-id'] as const;
let current: { serverUrl: string; account?: string; extension?: string } | undefined;
let installed = false;

function rawId(value: unknown): string | undefined {
    if (typeof value === 'number') return Number.isSafeInteger(value) && value > 0 ? String(value) : undefined;
    return typeof value === 'string' && /^[1-9]\d{0,31}$/.test(value) ? value : undefined;
}

export function clearRawAnalyticsRequestHeaders() {
    current = undefined;
}

export function setRawAnalyticsRequestHeaders(serverUrl: string, account: unknown, extension: unknown) {
    current = { serverUrl, account: rawId(account), extension: rawId(extension) };
    if (installed) return;
    installed = true;
    axios.interceptors.request.use(request => {
        // Raw IDs are intended for this adapter server, never arbitrary Axios destinations.
        for (const name of names) request.headers.delete(name);
        if (!current || process.env.MIXPANEL_RAW_IDS_ENABLED === 'false') return request;
        try {
            const server = new URL(current.serverUrl);
            const destination = new URL(request.url || '', request.baseURL || current.serverUrl);
            const serverPath = server.pathname.replace(/\/$/, '');
            if (destination.origin !== server.origin ||
                (serverPath && destination.pathname !== serverPath && !destination.pathname.startsWith(`${serverPath}/`))) return request;
            if (current.account) request.headers.set(names[0], current.account);
            if (current.extension) request.headers.set(names[1], current.extension);
        } catch { /* Invalid destinations receive no analytics identifiers. */ }
        return request;
    });
}
