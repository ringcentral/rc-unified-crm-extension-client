type UnknownRecord = Record<string, any>;

function getPageAccountDataFields(platform: UnknownRecord): UnknownRecord[] {
  const page = platform?.page ?? {};
  return [
    ...(page.callLog?.additionalFields ?? []),
    ...(page.messageLog?.additionalFields ?? []),
    ...(page.newContact?.additionalFields ?? []),
  ].filter(field => field?.accountDataKey || field?.accountDataKeyByContactType);
}

function getPlatformAccountDataKeys(platform: UnknownRecord): string[] {
  const adminKeys = getAdminAccountDataKeys(platform);
  const pageKeys = getPageAccountDataFields(platform).flatMap(field => [
    ...(field.accountDataKey ? [field.accountDataKey] : []),
    ...Object.values(field.accountDataKeyByContactType ?? {}),
  ]);
  return [...new Set([...adminKeys, ...pageKeys])] as string[];
}

function getAdminAccountDataKeys(platform: UnknownRecord): string[] {
  return [...new Set((platform?.adminSettings ?? [])
    .map((setting: UnknownRecord) => setting.accountDataKey)
    .filter(Boolean))] as string[];
}

export {
  getPageAccountDataFields,
  getAdminAccountDataKeys,
  getPlatformAccountDataKeys,
};
