import { chalk } from '@bomijs/utils';
import { readTemplateJson, writeTemplateJson } from '../utils/template';
import isGitUrl from 'is-git-url';
import assert from 'assert';

import { stopSpinner } from '../utils/spinner';

module.exports = api => {
  api.registerCommand({
    name: 'init',
    description: 'add a project template',
    details: `
      add <template-name> <git-repo-address>
    `.trim(),
    fn({ args }) {
      const templateName = args._[1];
      const gitAddress = args._[2];
      assert(!templateName, `The template name cannot be empty`);
      assert(!gitAddress, `Git addresses cannot be empty`);

      try {
        addProjectTemplate(templateName, gitAddress, { log: api.logger.log });
      } catch (err) {
        console.error(err);
        process.exit(1);
      }
    }
  });
};

/**
 * Add Project Templates.
 *
 * @param {String} templateName
 * @param {String} gitRepoAddress
 */

function addProjectTemplate(templateName, gitRepoAddress, { log }) {
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
}
