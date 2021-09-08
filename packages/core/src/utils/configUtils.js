const set = require('set-value');
const { deepmerge, lodash } = require('@bomijs/utils');

const getUserConfigWithKey = function getUserConfigWithKey({ key, userConfig }) {
  return lodash.get(userConfig, key);
};

const updateUserConfigWithKey = function updateUserConfigWithKey({ key, value, userConfig }) {
  set(userConfig, key, value);
};

const mergeDefault = function mergeDefault({ defaultConfig, config }) {
  if (lodash.isPlainObject(defaultConfig) && lodash.isPlainObject(config)) {
    return deepmerge(defaultConfig, config);
  }
  return typeof config !== 'undefined' ? config : defaultConfig;
};

const isEqual = function isEqual(a, b) {
  return lodash.isEqual(funcToStr(a), funcToStr(b));
};

function funcToStr(obj) {
  if (typeof obj === 'function') return obj.toString();
  if (lodash.isPlainObject(obj)) {
    return Object.keys(obj).reduce((memo, key) => {
      memo[key] = funcToStr(obj[key]);
      return memo;
    }, {});
  } else {
    return obj;
  }
}

module.exports = { getUserConfigWithKey, updateUserConfigWithKey, mergeDefault, isEqual };
