const chalk = require('chalk');
const readline = require('readline');
const boxen = require('boxen');
const format = require('util').format;
const pkg = require('../../package.json');

/**
 * Prefix.
 */

const prefix = '>>  mifan';
const sep = chalk.gray(':');

/**
 * Log a `message` to the console without boxen.
 *
 * @param {String} message
 */

exports.logWithBoxen = function (...args) {
  const len = args.length;
  const opts = len && args[len - 1];
  if (opts && typeof opts === 'string') {
    args.push({});
  }

  const msg = format.apply(format, args.slice(0, -1));
  const boxenOpts = {
    borderColor: 'green',
    borderStyle: 'round',
    align: 'center',
    padding: 1,
    margin: 1,
    ...(typeof opts === 'object' && opts)
  };
  console.log('\n' + boxen(msg, boxenOpts));
};

/**
 * Log a `message` to the console without prefix.
 *
 * @param {String} message
 */

exports.log = function (...args) {
  const msg = format.apply(format, args);
  console.log(msg);
};

/**
 * Log a `message` to the console.
 *
 * @param {String} message
 */

exports.info = function (...args) {
  const msg = format.apply(format, args);
  console.log(chalk.white(prefix), sep, msg);
};

/**
 * Log an error `message` to the console and exit.
 *
 * @param {String} message
 */

exports.fatal = function (...args) {
  if (args[0] instanceof Error) args[0] = args[0].message.trim();
  const msg = format.apply(format, args);
  console.error(chalk.red(prefix), sep, msg);
  process.exit(1);
};

/**
 * Log a success `message` to the console and exit.
 *
 * @param {String} message
 */

exports.success = function (...args) {
  const msg = format.apply(format, args);
  console.log(chalk.green(prefix), sep, msg);
};

/**
 * Clear TTY.
 *
 * @param {String} message
 */

exports.clear = function (...args) {
  const msg = format.apply(format, args);
  if (process.stdout.isTTY) {
    // Determine if it is in the terminal environment
    const blank = '\n'.repeat(process.stdout.rows);
    console.log(blank);
    // At the terminal, move the cursor to the starting coordinate of the standard output stream, and then clear the given TTY stream
    readline.cursorTo(process.stdout, 0, 0);
    readline.clearScreenDown(process.stdout);
    console.log(msg || chalk.bold.blue(`MIFAN CLI v${pkg.version}`));
  }
};
