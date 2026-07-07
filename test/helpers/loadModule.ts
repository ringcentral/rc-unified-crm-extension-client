// @ts-nocheck
export async function loadModule(modulePath) {
  globalThis.exports = {};
  const module = await import(modulePath);
  if (module.default && Object.keys(module.default).length > 0) {
    return module.default;
  }
  const namedExports = Object.keys(module)
    .filter((key) => key !== 'default')
    .reduce((result, key) => {
      result[key] = module[key];
      return result;
    }, {});
  if (Object.keys(namedExports).length > 0) {
    return namedExports;
  }
  return globalThis.exports;
}
