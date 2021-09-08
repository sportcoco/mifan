const readline = require('readline');
const boxen = require('boxen');
const format = require('util').format;
const { pkgUp, chalk } = require('@bomijs/utils');

module.exports = class Logger {
  constructor({ cwd = process.cwd(), prefix, sep }) {
    this.prefix = prefix || '>>  Mifan';
    this.sep = sep || chalk.gray(':');
    const PKG_JSON_PATH = pkgUp.sync({ cwd });
    this.pkg = PKG_JSON_PATH ? require(PKG_JSON_PATH) : null;
  }

  /**
   * Log a `message` to the console without boxen.
   *
   * @param {String} message
   */

  logWithBoxen(...args) {
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
  }

  /**
   * Log a `message` to the console without prefix.
   *
   * @param {String} message
   */

  log(...args) {
    const msg = format.apply(format, args);
    console.log(msg);
  }

  /**
   * Log a `message` to the console.
   *
   * @param {String} message
   */

  info(...args) {
    const msg = format.apply(format, args);
    console.log(chalk.white(this.prefix), this.sep, msg);
  }

  /**
   * Log an error `message` to the console and exit.
   *
   * @param {String} message
   */

  fatal(...args) {
    if (args[0] instanceof Error) args[0] = args[0].message.trim();
    const msg = format.apply(format, args);
    console.error(chalk.red(this.prefix), this.sep, msg);
    process.exit(1);
  }

  /**
   * Log a success `message` to the console and exit.
   *
   * @param {String} message
   */

  success(...args) {
    const msg = format.apply(format, args);
    console.log(chalk.green(this.prefix), this.sep, msg);
  }

  /**
   * Clear TTY.
   *
   * @param {String} message
   */

  clear(...args) {
    const msg = format.apply(format, args);
    if (process.stdout.isTTY) {
      // Determine if it is in the terminal environment
      const blank = '\n'.repeat(process.stdout.rows);
      console.log(blank);
      // At the terminal, move the cursor to the starting coordinate of the standard output stream, and then clear the given TTY stream
      readline.cursorTo(process.stdout, 0, 0);
      readline.clearScreenDown(process.stdout);
      console.log(msg || chalk.bold.blue(`MIFAN ${this.pkg ? `v${this.pkg.version}` : ''}`));
    }
  }
};
