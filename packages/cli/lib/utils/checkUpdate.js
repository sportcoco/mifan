const logger = require('./logger');
const updateNotifier = require('update-notifier');

module.exports = async function checkUpdate(pkg) {
  logger.clear();
  if (pkg) {
    updateNotifier({ pkg, updateCheckInterval: 1000 * 60 * 60 * 12 }).notify({
      isGlobal: true,
      boxenOpts: {
        borderColor: 'yellow',
        borderStyle: 'classic',
        padding: 2,
        margin: 1,
        align: 'center'
      }
    });
  }
};
