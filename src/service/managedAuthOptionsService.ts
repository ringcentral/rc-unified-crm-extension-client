import adminCore from '../core/admin';

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

async function refreshManagedAuthUserOptions({
  serverUrl,
  platformName,
  connectorId = '',
  userFields = [],
}: UnknownRecord): Promise<{ dynamicOptions: UnknownRecord; errors: unknown[] }> {
  const contextKey = getManagedAuthOptionsContextKey({ platformName, connectorId, mode: 'user' });
  const cachedOptions = getCachedManagedAuthOptions(contextKey);
  const dynamicFields = userFields.filter((field: UnknownRecord) => (
    field?.managed === true &&
    field?.managedScope === 'user' &&
    field?.managedFieldType === 'dynamic'
  ));
  const results = await Promise.allSettled(dynamicFields.map((field: UnknownRecord) => (
    adminCore.getManagedAuthOptions({
      serverUrl,
      platformName,
      fieldConst: field.const,
    })
  )));
  const dynamicOptions: UnknownRecord = {};
  const errors: unknown[] = [];
  results.forEach((result, index) => {
    const fieldConst = dynamicFields[index].const;
    if (result.status === 'fulfilled') {
      dynamicOptions[fieldConst] = result.value;
      return;
    }
    errors.push(result.reason);
    if (Object.prototype.hasOwnProperty.call(cachedOptions, fieldConst)) {
      dynamicOptions[fieldConst] = cachedOptions[fieldConst];
    }
  });
  setCachedManagedAuthOptions(contextKey, dynamicOptions);
  return { dynamicOptions, errors };
}

export {
  clearManagedAuthOptionsCache,
  getCachedManagedAuthOptions,
  getManagedAuthOptionsContextKey,
  refreshManagedAuthUserOptions,
  setCachedManagedAuthOptions,
};
