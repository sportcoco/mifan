const { chalk } = require('@bomijs/utils');

module.exports = api => {
  api.registerCommand({
    name: 'plugin',
    description: 'inspect mifan plugins',
    details: `
      # List plugins
      $ mifan plugin list
      # List plugins with enable
      $ mifan plugin List --enable
    `.trim(),
    fn({ args }) {
      const command = args._[0];
      switch (command) {
        case 'list':
          list();
          break;
        default:
          throw new Error(`Unsupported sub command ${command} for mifan plugin.`);
      }

      function list() {
        console.log();
        console.log(`  Plugins:`);
        console.log();
        Object.keys(api.service.plugins).forEach(pluginId => {
          const plugin = api.service.plugins[pluginId];
          const keyStr = ` ${chalk.blue(`[key: ${[plugin.key]}]`)}`;
          const isPresetStr = plugin.isPreset ? ` ${chalk.bold.green('(preset)')}` : '';
          const enableStr = args.enable
            ? api.service.isPluginEnable(plugin.id)
              ? `${chalk.green(` √ `)}`
              : `${chalk.red(` × `)}`
            : '';

          console.log(`    ${enableStr} - ${plugin.id}${keyStr}${isPresetStr}`);
        });
        console.log();
      }
    }
  });
};
