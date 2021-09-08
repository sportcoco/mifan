const { parse } = require('dotenv');
const {
  fsExtra: { existsSync, readFileSync }
} = require('@bomijs/utils');

module.exports = function loadDotEnv(envPath) {
  if (existsSync(envPath)) {
    const parsed = parse(readFileSync(envPath, 'utf-8')) || {};
    Object.keys(parsed).forEach(key => {
      // eslint-disable-next-line no-prototype-builtins
      if (!process.env.hasOwnProperty(key)) {
        process.env[key] = parsed[key];
      }
    });
  }
};
