function createChromeStorage(initialValues = {}) {
  const store = { ...initialValues };

  const local = {
    async get(keys) {
      if (keys === null || typeof keys === 'undefined') {
        return { ...store };
      }
      if (typeof keys === 'string') {
        return { [keys]: store[keys] };
      }
      if (Array.isArray(keys)) {
        return keys.reduce((result, key) => {
          result[key] = store[key];
          return result;
        }, {});
      }
      return Object.keys(keys).reduce((result, key) => {
        result[key] = Object.prototype.hasOwnProperty.call(store, key)
          ? store[key]
          : keys[key];
        return result;
      }, {});
    },

    async set(values) {
      Object.assign(store, values);
    },

    async remove(keys) {
      const keysToRemove = Array.isArray(keys) ? keys : [keys];
      for (const key of keysToRemove) {
        delete store[key];
      }
    },
  };

  return {
    chrome: {
      storage: {
        local,
      },
    },
    store,
  };
}

module.exports = {
  createChromeStorage,
};