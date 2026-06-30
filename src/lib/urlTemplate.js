function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj || {}, key);
}

function getUserSettingValue(userSettings, token) {
  if (!hasOwn(userSettings, token)) {
    return {
      found: false,
    };
  }
  const setting = userSettings[token];
  if (setting && typeof setting === 'object' && hasOwn(setting, 'value')) {
    return {
      found: true,
      value: setting.value,
    };
  }
  return {
    found: true,
    value: setting,
  };
}

function resolveTokenValue({ token, values, userSettings }) {
  if (hasOwn(values, token)) {
    return {
      found: true,
      value: values[token],
    };
  }
  return getUserSettingValue(userSettings, token);
}

function renderUrlTemplate({ template, values = {}, userSettings = {} }) {
  if (typeof template !== 'string') {
    return {
      url: template,
      missingTokens: [],
    };
  }
  const missingTokens = [];
  const url = template.replace(/\{([^{}\s]+)\}/g, (match, token) => {
    const resolved = resolveTokenValue({ token, values, userSettings });
    if (!resolved.found) {
      missingTokens.push(token);
      return match;
    }
    return String(resolved.value);
  });
  return {
    url,
    missingTokens,
  };
}

function isSafeHttpUrl(url) {
  return (
    typeof url === 'string' &&
    (url.startsWith('https://') || url.startsWith('http://')) &&
    !url.toLowerCase().includes('javascript')
  );
}

exports.renderUrlTemplate = renderUrlTemplate;
exports.isSafeHttpUrl = isSafeHttpUrl;
