const path = require('path');
const metadata = require('read-metadata');
const exists = require('fs').existsSync;
const { getGitUser } = require('./git');
const validateName = require('validate-npm-package-name');

/**
 * Read prompts metadata.
 *
 * @param {String} dir
 * @return {Object}
 */

module.exports = function options(name, dir) {
  const opts = getMetadata(dir);

  // setDefault(opts, 'name', name);
  // setValidateName(opts);

  const author = getGitUser();
  if (author) {
    setDefault(opts, 'author', author);
  }

  !opts.prompts && (opts.prompts = {});

  return opts;
};

/**
 * Gets the metadata from either a meta.json or meta.js file.
 *
 * @param  {String} dir
 * @return {Object}
 */

function getMetadata(dir) {
  const json = path.join(dir, 'meta.json');
  const js = path.join(dir, 'meta.js');
  let opts = {};

  if (exists(json)) {
    opts = metadata.sync(json);
  } else if (exists(js)) {
    const req = require(path.resolve(js));
    if (req !== Object(req)) {
      throw new Error('meta.js needs to expose an object');
    }
    opts = req;
  }

  return opts;
}

/**
 * Set the default value for a prompt question
 *
 * @param {Object} opts
 * @param {String} key
 * @param {String} val
 */

function setDefault(opts, key, val) {
  if (opts.schema) {
    opts.prompts = opts.schema;
    delete opts.schema;
  }
  const prompts = opts.prompts || (opts.prompts = {});
  if (!prompts[key] || typeof prompts[key] !== 'object') {
    prompts[key] = {
      type: 'string',
      default: val
    };
  } else {
    // eslint-disable-next-line
    prompts[key]['default'] = val;
  }
}
// eslint-disable-next-line
function setValidateName(opts) {
  const name = opts.prompts.name;
  const customValidate = name.validate;
  name.validate = name => {
    const its = validateName(name);
    if (!its.validForNewPackages) {
      const errors = (its.errors || []).concat(its.warnings || []);
      return 'Sorry, ' + errors.join(' and ') + '.';
    }
    if (typeof customValidate === 'function') return customValidate(name);
    return true;
  };
}
