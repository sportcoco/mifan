const { join, extname } = require('path');
const assert = require('assert');
const joi = require('joi');
const {
  chalk,
  chokidar,
  lodash,
  deepmerge,
  winPath,
  getFile,
  parseRequireDeps,
  cleanRequireCache,
  compatESModuleRequire,
  fsExtra: { existsSync }
} = require('@bomijs/utils');
const { ServiceStage } = require('./enums');
const { getUserConfigWithKey, updateUserConfigWithKey, mergeDefault, isEqual } = require('./utils/configUtils');

const CONFIG_FILES = ['.mifanrc.js'];

module.exports = class Config {
  constructor(opts) {
    this.cwd = opts.cwd || process.cwd();
    this.service = opts.service;
    this.localConfig = opts.localConfig;
  }

  getDefaultConfig() {
    const pluginIds = Object.keys(this.service.plugins);

    // collect plugins default config
    const defaultConfig = pluginIds.reduce((memo, pluginId) => {
      const { key, config = {} } = this.service.plugins[pluginId];
      if ('default' in config) {
        memo[key] = config.default;
      }
      return memo;
    }, {});
    return defaultConfig;
  }

  getConfig({ defaultConfig }) {
    assert(
      this.service.stage >= ServiceStage.pluginReady,
      `Config.getConfig() failed, it should not be executed before plugin is ready.`
    );

    const userConfig = this.getUserConfig();

    // 用于提示用户哪些 key 是未定义的
    // TODO: 考虑不排除 false 的 key
    const userConfigKeys = Object.keys(userConfig).filter(key => {
      return userConfig[key] !== false;
    });

    // get config
    const pluginIds = Object.keys(this.service.plugins);
    pluginIds.forEach(pluginId => {
      const { key, config = {} } = this.service.plugins[pluginId];
      // recognize as key if have schema config
      if (!config.schema) return;

      const value = getUserConfigWithKey({ userConfig, key });
      // 不校验 false 的值，此时已禁用插件
      if (value === false) return;

      // do validate
      const schema = config.schema(joi);
      assert(joi.isSchema(schema), `schema return from plugin ${pluginId} is not valid schema.`);
      const { error } = schema.validate(value);
      if (error) {
        const e = new Error(`Validate config "${key}" failed, ${error.message}`);
        e.stack = error.stack;
        throw e;
      }

      // remove key
      const index = userConfigKeys.indexOf(key.split('.')[0]);
      if (index !== -1) {
        userConfigKeys.splice(index, 1);
      }

      // update userConfig with defaultConfig
      if (key in defaultConfig) {
        const newValue = mergeDefault({
          defaultConfig: defaultConfig[key],
          config: value
        });
        updateUserConfigWithKey({
          key,
          value: newValue,
          userConfig
        });
      }
    });

    if (userConfigKeys.length) {
      const keys = userConfigKeys.length > 1 ? 'keys' : 'key';
      throw new Error(`Invalid config ${keys}: ${userConfigKeys.join(', ')}`);
    }

    return userConfig;
  }

  getUserConfig() {
    const configFile = this.getConfigFile();
    this.configFile = configFile;
    // 潜在问题：
    // .local 和 .env 的配置必须有 configFile 才有效
    if (configFile) {
      let envConfigFile;
      if (process.env.MIFAN_ENV) {
        const envConfigFileName = this.addAffix(configFile, process.env.MIFAN_ENV);
        const fileNameWithoutExt = envConfigFileName.replace(extname(envConfigFileName), '');
        envConfigFile = getFile({
          base: this.cwd,
          fileNameWithoutExt,
          type: 'javascript'
        }).filename;

        if (!envConfigFile) {
          throw new Error(
            `get user config failed, ${envConfigFile} does not exist, but process.env.MIFAN_ENV is set to ${process.env.MIFAN_ENV}.`
          );
        }
      }

      const files = [configFile, envConfigFile, this.localConfig && this.addAffix(configFile, 'local')]
        .filter(f => !!f)
        .map(f => join(this.cwd, f))
        .filter(f => existsSync(f));

      // clear require cache and set babel register
      const requireDeps = files.reduce((memo, file) => {
        return memo.concat(parseRequireDeps(file));
      }, []);
      requireDeps.forEach(cleanRequireCache);
      this.service.babelRegister.setOnlyMap({
        key: 'config',
        value: requireDeps
      });

      // require config and merge
      return this.mergeConfig(...this.requireConfigs(files));
    } else {
      return {};
    }
  }

  getConfigFile() {
    const configFile = CONFIG_FILES.find(f => existsSync(join(this.cwd, f)));
    return configFile ? winPath(configFile) : null;
  }

  addAffix(file, affix) {
    const ext = extname(file);
    return file.replace(new RegExp(`${ext}$`), `.${affix}${ext}`);
  }

  mergeConfig(...configs) {
    let ret = {};
    for (const config of configs) {
      // TODO: 精细化处理，比如处理 dotted config key
      ret = deepmerge(ret, config);
    }
    return ret;
  }

  requireConfigs(configFiles = []) {
    return configFiles.map(f => compatESModuleRequire(require(f)));
  }

  getWatchFilesAndDirectories() {
    const ENV = process.env.MIFAN_ENV;
    const configFiles = lodash.clone(CONFIG_FILES);
    CONFIG_FILES.forEach(f => {
      if (this.localConfig) {
        configFiles.push(this.addAffix(f, 'local'));
      }
      if (ENV) {
        configFiles.push(this.addAffix(f, ENV));
      }
    });

    const configDir = winPath(join(this.cwd, 'config'));

    const files = configFiles
      .reduce((memo, f) => {
        const file = winPath(join(this.cwd, f));
        if (existsSync(file)) {
          memo = memo.concat(parseRequireDeps(file));
        } else {
          memo.push(file);
        }
        return memo;
      }, [])
      .filter(f => !f.startsWith(configDir));

    return [configDir].concat(files);
  }

  watch(opts) {
    let paths = this.getWatchFilesAndDirectories();
    let userConfig = opts.userConfig || {};
    const watcher = chokidar.watch(paths, {
      ignoreInitial: true,
      cwd: this.cwd
    });

    watcher.on('all', (event, path) => {
      console.log(chalk.green(`[${event}] ${path}`));
      const newPaths = this.getWatchFilesAndDirectories();
      const diffs = lodash.difference(newPaths, paths);
      if (diffs.length) {
        watcher.add(diffs);
        paths = paths.concat(diffs);
      }

      const newUserConfig = this.getUserConfig();
      const pluginChanged = [];
      const valueChanged = [];
      Object.keys(this.service.plugins).forEach(pluginId => {
        const { key, config = {} } = this.service.plugins[pluginId];
        // recognize as key if have schema config
        if (!config.schema) return;
        if (!isEqual(newUserConfig[key], userConfig[key])) {
          const changed = {
            key,
            pluginId: pluginId
          };
          if (newUserConfig[key] === false || userConfig[key] === false) {
            pluginChanged.push(changed);
          } else {
            valueChanged.push(changed);
          }
        }
      });

      if (pluginChanged.length || valueChanged.length) {
        opts.onChange({
          userConfig: newUserConfig,
          pluginChanged,
          valueChanged
        });
      }

      userConfig = newUserConfig;
    });

    return () => {
      watcher.close();
    };
  }
};
