const { EventEmitter } = require('events');
const { join } = require('path');
const assert = require('assert');
const {
  lodash,
  BabelRegister,
  fsExtra: { existsSync }
} = require('@bomijs/utils');
const { AsyncSeriesWaterfallHook } = require('tapable');
const { pathToObj, resolvePlugins, resolvePresets, getServicePaths } = require('./utils/pluginUtils');
const loadDotEnv = require('./utils/loadDotEnv');
const isPromise = require('./utils/isPromise');
const Config = require('./Config');
const PluginAPI = require('./PluginAPI');
const { ApplyPluginsType, ConfigChangeType, EnableBy, PluginType, ServiceStage } = require('./enums');
const { getUserConfigWithKey } = require('./utils/configUtils');

module.exports = class Service extends EventEmitter {
  constructor(opts) {
    super();

    // initial val
    this.skipPluginIds = new Set();
    this.stage = ServiceStage.uninitialized;
    this.commands = {};
    this.plugins = {};
    this.pluginMethods = {};
    this._extraPresets = [];
    this._extraPlugins = [];
    this.config = {};
    this.hooksByPluginId = {};
    this.hooks = {};
    this.ApplyPluginsType = ApplyPluginsType;
    this.EnableBy = EnableBy;
    this.ConfigChangeType = ConfigChangeType;
    this.ServiceStage = ServiceStage;

    this.cwd = opts.cwd || process.cwd();
    // repoDir should be the root dir of repo
    this.pkg = opts.pkg || this.resolvePackage();
    this.env = opts.env || process.env.NODE_ENV;

    assert(existsSync(this.cwd), `cwd ${this.cwd} does not exist.`);

    // register babel before config parsing
    this.babelRegister = new BabelRegister();

    // load .env or .local.env
    this.loadEnv();

    // get user config without validation
    this.configInstance = new Config({
      cwd: this.cwd,
      service: this,
      localConfig: this.env === 'development'
    });
    this.userConfig = this.configInstance.getUserConfig();

    // get paths
    this.paths = getServicePaths({
      cwd: this.cwd,
      config: this.userConfig,
      env: this.env
    });

    // Step initial presets and plugins
    const baseOpts = {
      pkg: this.pkg,
      cwd: this.cwd
    };
    this.initialPresets = resolvePresets({
      ...baseOpts,
      presets: opts.presets || [],
      userConfigPresets: this.userConfig.presets || []
    });
    this.initialPlugins = resolvePlugins({
      ...baseOpts,
      plugins: opts.plugins || [],
      userConfigPlugins: this.userConfig.plugins || []
    });

    this.babelRegister.setOnlyMap({
      key: 'initialPlugins',
      value: lodash.uniq([
        ...this.initialPresets.map(({ path }) => path),
        ...this.initialPlugins.map(({ path }) => path)
      ])
    });
  }

  setStage(stage) {
    this.stage = stage;
  }

  resolvePackage() {
    try {
      return require(join(this.cwd, 'package.json'));
    } catch (e) {
      return {};
    }
  }

  loadEnv() {
    const basePath = join(this.cwd, `.env`);
    const localPath = `${basePath}.local`;
    loadDotEnv(basePath);
    loadDotEnv(localPath);
  }

  async init() {
    this.setStage(ServiceStage.init);
    // We should have the final hooksByPluginId which is added with api.register()
    await this.initPresetsAndPlugins();

    // hooksByPluginId -> hooks
    // hooks is mapped with hook key, prepared for applyPlugins()
    this.setStage(ServiceStage.initHooks);
    Object.keys(this.hooksByPluginId).forEach(id => {
      const hooks = this.hooksByPluginId[id];
      hooks.forEach(hook => {
        const { key } = hook;
        hook.pluginId = id;
        this.hooks[key] = (this.hooks[key] || []).concat(hook);
      });
    });

    // plugin is totally ready
    this.setStage(ServiceStage.pluginReady);
    await this.applyPlugins({
      key: 'onPluginReady',
      type: ApplyPluginsType.event
    });

    // get config, including:
    // 1. merge default config
    // 2. validated
    this.setStage(ServiceStage.getConfig);
    const defaultConfig = await this.applyPlugins({
      key: 'modifyDefaultConfig',
      type: ApplyPluginsType.modify,
      initialValue: await this.configInstance.getDefaultConfig()
    });

    this.config = await this.applyPlugins({
      key: 'modifyConfig',
      type: ApplyPluginsType.modify,
      initialValue: this.configInstance.getConfig({ defaultConfig })
    });

    // merge paths to keep the this.paths ref
    this.setStage(ServiceStage.getPaths);
    // config.build.outputPath may be modified by plugins
    if (this.config && this.config.build && this.config.build.outputPath) {
      this.paths.absOutputPath = join(this.cwd, this.config.build.outputPath);
    }
    const paths = await this.applyPlugins({
      key: 'modifyPaths',
      type: ApplyPluginsType.modify,
      initialValue: this.paths
    });
    Object.keys(paths).forEach(key => {
      this.paths[key] = paths[key];
    });
  }

  async initPresetsAndPlugins() {
    // 初始化所有 prestes 和 plugins
    this.setStage(ServiceStage.initPresets);
    this._extraPlugins = [];
    while (this.initialPresets.length) {
      await this.initPreset(this.initialPresets.shift());
    }

    this.setStage(ServiceStage.initPlugins);
    this._extraPlugins.push(...this.initialPlugins);
    while (this._extraPlugins.length) {
      await this.initPlugin(this._extraPlugins.shift());
    }
  }

  async initPreset(preset) {
    const { id, key, apply } = preset;
    preset.isPreset = true;
    const api = this.getPluginAPI({ id, key, service: this });

    // register before apply
    this.registerPlugin(preset);
    // TODO: ...defaultConfigs 考虑要不要支持，可能这个需求可以通过其他渠道实现
    const { presets, plugins } = await this.applyApi({
      api,
      apply
    });

    // register extra presets and plugins
    if (presets) {
      assert(Array.isArray(presets), `presets returned from preset ${id} must be Array.`);
      // 插到最前面，下个 while 循环优先执行
      this._extraPresets.splice(
        0,
        0,
        ...presets.map(path => pathToObj({ type: PluginType.preset, path, cwd: this.cwd }))
      );
    }

    // 深度优先
    const extraPresets = lodash.clone(this._extraPresets);
    this._extraPresets = [];
    while (extraPresets.length) {
      await this.initPreset(extraPresets.shift());
    }

    if (plugins) {
      assert(Array.isArray(plugins), `plugins returned from preset ${id} must be Array.`);
      this._extraPlugins.push(...plugins.map(path => pathToObj({ type: PluginType.plugin, path, cwd: this.cwd })));
    }
  }

  async initPlugin(plugin) {
    const { id, key, apply } = plugin;

    const api = this.getPluginAPI({ id, key, service: this });
    // register before apply
    this.registerPlugin(plugin);
    await this.applyApi({ api, apply });
  }

  getPluginAPI(opts) {
    const pluginApi = new PluginAPI(opts);
    // register built-in methods
    ['onPluginReady', 'modifyPaths', 'onStart', 'modifyDefaultConfig', 'modifyConfig'].forEach(name =>
      pluginApi.registerMethod({ name, exitsError: false })
    );

    // 由于 pluginMethods 需要在 register 阶段可用
    // 必须通过 proxy 的方式动态获取最新，以实现边注册边使用的效果
    return new Proxy(pluginApi, {
      get: (target, prop) => {
        if (this.pluginMethods[prop]) return this.pluginMethods[prop];
        if (
          [
            'applyPlugins',
            'ApplyPluginsType',
            'EnableBy',
            'ConfigChangeType',
            'babelRegister',
            'stage',
            'ServiceStage',
            'paths',
            'cwd',
            'pkg',
            'userConfig',
            'config',
            'env',
            'args',
            'hasPlugins',
            'hasPresets'
          ].includes(prop)
        ) {
          return typeof this[prop] === 'function' ? this[prop].bind(this) : this[prop];
        }
        return target[prop];
      }
    });
  }

  async applyApi({ api, apply }) {
    let ret = apply()(api);
    if (isPromise(ret)) {
      ret = await ret;
    }
    return ret || {};
  }

  getPluginOptsWithKey(key) {
    return getUserConfigWithKey({
      key,
      userConfig: this.userConfig
    });
  }

  registerPlugin(plugin) {
    // 考虑要不要去掉这里的校验逻辑
    // 理论上不会走到这里，因为在 describe 的时候已经做了冲突校验
    if (this.plugins[plugin.id]) {
      const name = plugin.isPreset ? 'preset' : 'plugin';
      throw new Error(`\
        ${name} ${plugin.id} is already registered by ${this.plugins[plugin.id].path}, \
        ${name} from ${plugin.path} register failed.`);
    }
    this.plugins[plugin.id] = plugin;
  }

  hasPlugins(pluginIds) {
    return pluginIds.every(pluginId => {
      const plugin = this.plugins[pluginId];
      return plugin && !plugin.isPreset && this.isPluginEnable(pluginId);
    });
  }

  hasPresets(presetIds) {
    return presetIds.every(presetId => {
      const preset = this.plugins[presetId];
      return preset && preset.isPreset && this.isPluginEnable(presetId);
    });
  }

  isPluginEnable(pluginId) {
    // 插件是否被激活
    // api.skipPlugins() 的插件
    if (this.skipPluginIds.has(pluginId)) return false;
    const { key, enableBy } = this.plugins[pluginId];

    // 手动设置为 false
    if (this.userConfig[key] === false) return false;

    // 配置开启
    if (enableBy === this.EnableBy.config && !(key in this.userConfig)) {
      return false;
    }
    // 函数自定义开启
    if (typeof enableBy === 'function') {
      return enableBy();
    }
    // 注册开启
    return true;
  }

  // 取得 register 注册的 hooks 执行后的数据
  async applyPlugins(opts) {
    const hooks = this.hooks[opts.key] || [];
    switch (opts.type) {
      case ApplyPluginsType.add:
        if ('initialValue' in opts) {
          assert(
            Array.isArray(opts.initialValue),
            `applyPlugins failed, opts.initialValue must be Array if opts.type is add.`
          );
        }
        const tAdd = new AsyncSeriesWaterfallHook(['memo']); // eslint-disable-line
        for (const hook of hooks) {
          if (!this.isPluginEnable(hook.pluginId)) {
            continue;
          }
          tAdd.tapPromise(
            {
              name: hook.pluginId,
              stage: hook.stage || 0,
              before: hook.before
            },
            async memo => {
              const items = await hook.fn(opts.args);
              return memo.concat(items);
            }
          );
        }
        return await tAdd.promise(opts.initialValue || []);

      case ApplyPluginsType.modify:
        const tModify = new AsyncSeriesWaterfallHook(['memo']); // eslint-disable-line
        for (const hook of hooks) {
          if (!this.isPluginEnable(hook.pluginId)) {
            continue;
          }
          tModify.tapPromise(
            {
              name: hook.pluginId,
              stage: hook.stage || 0,
              before: hook.before
            },
            async memo => {
              return await hook.fn(memo, opts.args);
            }
          );
        }
        return await tModify.promise(opts.initialValue);

      case ApplyPluginsType.event:
        const tEvent = new AsyncSeriesWaterfallHook(['_']); // eslint-disable-line
        for (const hook of hooks) {
          if (!this.isPluginEnable(hook.pluginId)) {
            continue;
          }
          tEvent.tapPromise(
            {
              name: hook.pluginId,
              stage: hook.stage || 0,
              before: hook.before
            },
            async () => {
              await hook.fn(opts.args);
            }
          );
        }
        return await tEvent.promise();

      default:
        throw new Error(`applyPlugin failed, type is not defined or is not matched, got ${opts.type}.`);
    }
  }

  async run({ name, args = {} }) {
    args._ = args._ || [];
    // shift the command itself
    args._[0] === name && args._.shift();

    this.args = args;
    await this.init();

    this.setStage(ServiceStage.run);
    await this.applyPlugins({
      key: 'onStart',
      type: ApplyPluginsType.event,
      args: {
        args
      }
    });
    return this.runCommand({ name, args });
  }

  async runCommand({ name, args = {} }) {
    assert(this.stage >= ServiceStage.init, `service is not initialized.`);

    args._ = args._ || [];
    // shift the command itself
    args._[0] === name && args._.shift();

    const command = typeof this.commands[name] === 'string' ? this.commands[this.commands[name]] : this.commands[name];
    assert(command, `run command failed, command ${name} does not exists.`);

    const { fn } = command;
    return fn({ args });
  }
};
