type UnknownRecord = Record<string, any>;

const optionCache = new Map<string, UnknownRecord>();

function getManagedAuthOptionsContextKey({
  platformName,
  connectorId = '',
  mode,
}: UnknownRecord): string {
  return [platformName ?? '', connectorId, mode].join(':');
}

function getCachedManagedAuthOptions(contextKey: string): UnknownRecord {
  return {
    ...(optionCache.get(contextKey) ?? {}),
  };
}

function setCachedManagedAuthOptions(contextKey: string, dynamicOptions: UnknownRecord): void {
  optionCache.set(contextKey, {
    ...dynamicOptions,
  });
}

function clearManagedAuthOptionsCache(): void {
  optionCache.clear();
}

export {
  clearManagedAuthOptionsCache,
  getCachedManagedAuthOptions,
  getManagedAuthOptionsContextKey,
  setCachedManagedAuthOptions,
};

