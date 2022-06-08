const chalk = require('chalk');
const inquirer = require('inquirer');
const { stopSpinner } = require('./utils/spinner');
const { log } = require('./utils/logger');
const { readTemplateJson, writeTemplateJson } = require('./utils/template');

module.exports = function del(...args) {
  try {
    delProjectTemplate(...args);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

/**
 * Delete Project Templates.
 *
 * @param {String} templateName
 */

async function delProjectTemplate(templateName) {
  const templateGitRepoJson = readTemplateJson();
  if (!templateGitRepoJson[templateName]) {
    console.log(`  ` + chalk.red(`Template name ${templateName} has not exists.`));
    return;
  }
  const { ok } = await inquirer.prompt([
    {
      name: 'ok',
      type: 'confirm',
      message: `Make sure you want to delete template name ${templateName}?`
    }
  ]);
  if (!ok) {
    return;
  }
  delete templateGitRepoJson[templateName];

  writeTemplateJson(templateGitRepoJson);

  stopSpinner();
  log();
  log(`✨  Successfully delete project template ${chalk.yellow(templateName)}.`);
  log();
}
