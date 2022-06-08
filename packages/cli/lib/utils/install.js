const inquirer = require('inquirer');
const chalk = require('chalk');
const execa = require('execa');
const exec = require('./exec');
const logger = require('./logger');
const { hasProjectGit } = require('./git');

module.exports = opts => {
  return install(opts).catch(err => {
    console.error(err);
    process.exit(1);
  });
};

async function install(opts) {
  // Prioritize YARN
  const hasYarn = execa.sync('yarn', ['--version']).stdout;

  // 1. cd to the target
  try {
    process.chdir(opts.inPlace ? './' : opts.name);
  } catch (err) {
    logger.fatal(err);
  }

  // 2. git init
  logStep('Initializing git repository...', '🗃  ');
  if (!hasProjectGit()) {
    await exec('git', ['init'], { stdio: 'ignore' });
  }

  // 3. check lerna project and install
  logStep('Installing additional dependencies...', '⚙️  ');
  if (isLerna()) {
    if (!hasYarn) {
      const { ok } = await inquirer.prompt([
        {
          type: 'confirm',
          message: 'Install YARN globally?',
          name: 'ok'
        }
      ]);

      if (ok) {
        await exec('npm', ['install', '-g', 'yarn']);
      }
    }

    await exec('yarn', ['install']);
  } else {
    await exec(hasYarn ? 'yarn' : 'npm', ['install']);
  }

  // 4. done
  logger.logWithBoxen(`✨  Successfully created project ${chalk.yellow(opts.name)}.`);

  if (opts.run) {
    logStep('Start running the project', '⚓  ');
    hasYarn ? exec('yarn', ['serve']) : exec('npm', ['run', 'serve']);
  } else {
    logStep(`Get started with the following commands:`, '👉  ');
    logStep(chalk.cyan(`cd ${opts.name}`), chalk.grey(` $ `));
    logStep(chalk.cyan(`${hasYarn ? 'yarn' : 'npm run'} serve`), chalk.grey(` $ `));
  }
}

function logStep(name, prefix = '>> Install:') {
  logger.log(`${prefix}${chalk.white.bold(name)}`);
  console.log();
}

function isLerna() {
  let lerna;
  try {
    lerna = require('./lerna.json');
  } catch (err) {
    lerna = process.env.IS_LERNA;
  }
  return !!lerna;
}
