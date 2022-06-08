const chalk = require('chalk');
const isGitUrl = require('is-git-url');
const { stopSpinner } = require('./utils/spinner');
const { log } = require('./utils/logger');
const { readTemplateJson, writeTemplateJson } = require('./utils/template');

module.exports = function add(...args) {
  try {
    addProjectTemplate(...args);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

/**
 * Add Project Templates.
 *
 * @param {String} templateName
 * @param {String} gitRepoAddress
 */

function addProjectTemplate(templateName, gitRepoAddress) {
  const templateGitRepoJson = readTemplateJson();
  if (templateGitRepoJson[templateName]) {
    console.log(`  ` + chalk.red(`Template name ${templateName} has exists.`));
    return;
  }
  if (!isGitUrl(gitRepoAddress)) {
    console.log(`  ` + chalk.red(`Git repo address ${gitRepoAddress} is not a correct git repo.`));
    return;
  }
  // 转化为需要的正确格式
  const correctGitRepo = getRealGitRepo(gitRepoAddress);
  templateGitRepoJson[templateName] = {
    git: gitRepoAddress,
    download: correctGitRepo
  };
  writeTemplateJson(templateGitRepoJson);
  stopSpinner();
  log();
  log(`✨  Successfully add project template ${chalk.yellow(templateName)}.`);
  log();
}

/**
 * Format
 * https => https://github.com/NuoHui/node_code_constructor.git
 * ssh => git@github.com:NuoHui/node_code_constructor.git
 * want => github:NuoHui/node_code_constructor
 *
 * @param {String} gitRepo
 */

function getRealGitRepo(gitRepo) {
  const sshRegExp = /^git@github.com:(.+)\/(.+).git$/;
  const httpsRegExp = /^https:\/\/github.com\/(.+)\/(.+).git$/;
  if (sshRegExp.test(gitRepo)) {
    // ssh
    const match = gitRepo.match(sshRegExp);
    return `github:${match[1]}/${match[2]}`;
  }
  if (httpsRegExp.test(gitRepo)) {
    // https
    const match = gitRepo.match(httpsRegExp);
    return `github:${match[1]}/${match[2]}`;
  }

  return `direct:${gitRepo}`;
}
