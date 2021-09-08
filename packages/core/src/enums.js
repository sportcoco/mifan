const PluginType = Object.freeze({
  preset: 'preset',
  plugin: 'plugin'
});

const ServiceStage = Object.freeze({
  uninitialized: 0,
  constructor: 1,
  init: 2,
  initPresets: 3,
  initPlugins: 4,
  initHooks: 5,
  pluginReady: 6,
  getConfig: 7,
  getPaths: 8,
  run: 9
});

const ConfigChangeType = Object.freeze({
  reload: 'reload',
  regenerateTmpFiles: 'regenerateTmpFiles'
});

const ApplyPluginsType = Object.freeze({
  add: 'add',
  modify: 'modify',
  event: 'event'
});

const EnableBy = Object.freeze({
  register: 'register',
  config: 'config'
});

module.exports = { PluginType, ServiceStage, ConfigChangeType, ApplyPluginsType, EnableBy };
