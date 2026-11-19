export type RingCXWebhookHeader = { name: string; value: string };

// The custom header RingCX must send with every call event; server side logging rejects events
// without it. Returns null when the response has no complete header.
export function getRingCXWebhookHeader(result: Record<string, any> | null | undefined): RingCXWebhookHeader | null {
    const header = result?.ringcxWebhookHeader;
    if (typeof header?.name === 'string' && header.name && typeof header?.value === 'string' && header.value) {
        return { name: header.name, value: header.value };
    }
    return null;
}
