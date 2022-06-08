const chalk = require('chalk');
const { readTemplateJson } = require('./utils/template');
const { stopSpinner } = require('./utils/spinner');
const { log } = require('./utils/logger');

module.exports = async function list() {
  try {
    return getAllTemplate();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

/**
 * Read the template list.
 *
 */

function getAllTemplate() {
  const templateGitRepoJson = readTemplateJson();

  for (const key in templateGitRepoJson) {
    stopSpinner();
    // eslint-disable-next-line
    log(`➡️  Template name ${chalk.yellow(key)},  Git address ${chalk.blue(templateGitRepoJson[key]['git'])}`);
    log();
  }

  if (!Object.keys(templateGitRepoJson).length) {
    stopSpinner();
    log(`💔  No any template.`);
    log();
  }
}
