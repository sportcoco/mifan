#!/usr/bin/env node
const didYouMean = require('didyoumean');
const program = require('commander');
const semver = require('semver');
const chalk = require('chalk');
const checkUpdate = require('../lib/utils/checkUpdate');
const pkg = require('../package.json');

didYouMean.threshold = 0.7;

// 检测node版本
checkNodeVersion('@assits/mifan-cli', pkg);

// 检查更新版本
checkUpdate(pkg);

program.version(pkg.version, '-v, --version').usage('<command> [options]');

// 初始化项目模板
program
  .command('init')
  .description('init a new project from a template')
  .option('-c, --clone', 'use git clone')
  .option('-r, --run', 'run the project')
  .option('--mock [value]', 'use mock data to generate project', commaSeparatedList)
  .option('--download [value]', 'download the remote template')
  .action(async cmd => {
    validateArgsLen(process.argv.length, 7);
    require('../lib/init')(cmd);
  });

// 添加一个项目模板
program
  .command('add <template-name> <git-repo-address>')
  .description('add a project template')
  .action(async (templateName, gitRepoAddress, cmd) => {
    validateArgsLen(process.argv.length, 5);
    require('../lib/add')(lowercase(templateName), gitRepoAddress);
  });

// 删除一个项目模板
program
  .command('del <template-name>')
  .description('delete a project template')
  .action(async (templateName, cmd) => {
    validateArgsLen(process.argv.length, 4);
    require('../lib/del')(templateName);
  });

// 列出支持的项目模板
program
  .command('list')
  .description('list all available project template')
  .action(async cmd => {
    validateArgsLen(process.argv.length, 3);
    require('../lib/list')();
  });

// 处理非法命令
program.arguments('<command>').action(cmd => {
  // 不退出输出帮助信息
  program.outputHelp();
  console.log(`  ` + chalk.red(`Unknown command ${chalk.yellow(cmd)}.`));
  console.log();
  suggestCommands(cmd);
});

program.parse(process.argv);

// 显示帮助信息
if (!process.argv.slice(2).length) {
  program.outputHelp();
}

/**
 * Comma-separated list.
 *
 * @param {String} value
 */

function commaSeparatedList(value) {
  return value.split(',');
}

/**
 * Suggest that command.
 *
 * @param {Object} cmd
 */

function suggestCommands(cmd) {
  const avaliableCommands = program.commands.map(cmd => {
    return cmd._name;
  });
  const suggestion = didYouMean(cmd, avaliableCommands);

  if (suggestion) {
    console.log(`  ` + chalk.red(`Did you mean ${chalk.yellow(suggestion)}?`));
  }
}

function lowercase(str) {
  return str.toLocaleLowerCase();
}

function validateArgsLen(argvLen, maxArgvLens) {
  if (argvLen > maxArgvLens) {
    console.log(chalk.yellow('\n Info: You provided more than argument. the rest are ignored.'));
  }
}

/**
 * Ensure minimum supported node version is used.
 *
 * @param {String} name
 * @param {Object} pkg
 */

function checkNodeVersion(name, pkg) {
  if (!semver.satisfies(process.version, pkg.engines.node)) {
    console.log(
      chalk.red(
        'You are using Node ' +
          process.version +
          ', but this version of ' +
          name +
          ' requires Node ' +
          pkg.engines.node +
          '.\nPlease upgrade your Node version.'
      )
    );

    process.exit(1);
  }
}
