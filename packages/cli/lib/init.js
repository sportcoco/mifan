const validateName = require('validate-npm-package-name');
const download = require('download-git-repo');
const inquirer = require('inquirer');
const exists = require('fs-extra').existsSync;
const path = require('path');
const rm = require('rimraf').sync;
const os = require('os');

const generate = require('./generate');
const logger = require('./utils/logger');
const install = require('./utils/install');
const { pauseSpinner, stopSpinner, logWithSpinner } = require('./utils/spinner');
const { readTemplateJson } = require('./utils/template');

module.exports = function init(cmd) {
  try {
    initProject(cmd);
  } catch (err) {
    pauseSpinner();
    console.error(err);
    process.exit(1);
  }
};

async function initProject(cmd) {
  const TEMPLATE_GIT_REPO = readTemplateJson();

  const TEMPLATE_FILES = (Object.keys(TEMPLATE_GIT_REPO) || []).map(key => {
    return {
      name: TEMPLATE_GIT_REPO[key].name,
      value: key
    };
  });

  let template = '';

  try {
    if (!cmd.download) {
      const { key } = await inquirer.prompt([
        {
          type: 'rawlist',
          name: 'key',
          required: true,
          message: `Please select the template :`,
          choices: TEMPLATE_FILES
        }
      ]);

      template = TEMPLATE_GIT_REPO[key]['download']; // eslint-disable-line
    } else {
      template = `direct:${cmd.download}`;
    }

    // Run
    run(template, cmd);
  } catch (err) {
    console.log('err:', err);
  }
}

/**
 * Check, generate the project.
 *
 * @param {Object} opts
 */

async function run(template, cmd) {
  const tmp = await fetchRomteTemplate({ template, clone: cmd.clone }).catch(logger.fatal);

  const { name, to, inPlace } = await handlerName(cmd.mock).catch(logger.fatal);

  generateProject({ name, to, inPlace, tmp }, cmd);
}

/**
 * Download  a template repo to the temporary folder.
 *
 * @param {String} opts.template
 * @param {Boolean} opts.clone
 */
function fetchRomteTemplate(opts) {
  const template = opts.template;
  const clone = opts.clone || /^direct:/.test(template) ? true : false; // eslint-disable-line
  const tmp = path.resolve(os.homedir(), '.mifan-templates', 'mifan-cli');
  stopSpinner();
  logWithSpinner(`⠋`, `Downloading template...`);

  if (clone) rm(tmp);

  return new Promise((resolve, reject) => {
    download(template, tmp, { clone }, err => {
      if (err) {
        // eslint-disable-next-line
        return reject('Failed to download repo ' + template + ': ' + err.message.trim());
      }
      return resolve(tmp);
    });
  }).finally(() => {
    pauseSpinner();
  });
}

/**
 * Input, check the project name.
 *
 * @param {Object} opts
 */

async function handlerName(mock) {
  // input project name
  const { projectName } = await inquirer.prompt([
    {
      type: 'string',
      name: 'projectName',
      message: `Please enter a project name :`
    }
  ]);

  const inPlace = !projectName || projectName === '.';
  const name = inPlace ? path.relative('../', process.cwd()) : projectName;
  const to = path.resolve(projectName || '.');

  // Verify project name
  const its = validateName(name);
  if (!its.validForNewPackages) {
    const errors = (its.errors || []).concat(its.warnings || []);
    // eslint-disable-next-line
    return Promise.reject('Sorry, ' + errors.join(' and ') + '.');
  }

  if (!mock && (inPlace || exists(to))) {
    const { ok } = await inquirer.prompt([
      {
        type: 'confirm',
        message: inPlace ? 'Generate project in current directory?' : 'Target directory exists. Continue?',
        name: 'ok'
      }
    ]);

    if (ok) {
      return Promise.resolve({ name, to, inPlace });
    } else {
      process.exit(1);
    }
  }

  return Promise.resolve({ name, to, inPlace });
}

/**
 * Generate a project from a template repo.
 *
 * @param {Object} opts
 */

async function generateProject(opts, cmd) {
  const { name, tmp, to, inPlace } = opts;

  if (exists(to)) rm(to);

  generate(
    {
      name,
      src: tmp,
      dest: to,
      mockList: cmd.mock
    },
    err => {
      if (err) logger.fatal(err);

      install({ inPlace, name, run: cmd.run });
    }
  );
}
