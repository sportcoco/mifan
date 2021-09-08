const { basename, dirname, extname, join, relative } = require('path');
const assert = require('assert');
const {
  compatESModuleRequire,
  resolve,
  lodash,
  winPath,
  pkgUp,
  fsExtra: { existsSync, statSync }
} = require('@bomijs/utils');

const { PluginType } = require('../enums');

const TYPE_RE = {
  [PluginType.plugin]: /^(@mifan\/|mifan-)plugin-/,
  [PluginType.preset]: /^(@mifan\/|mifan-)preset-/
};

function isPluginOrPreset(type, name) {
  const hasScope = name.charAt(0) === '@';
  const re = TYPE_RE[type];
  if (hasScope) {
    return re.test(name.split('/')[1]) || re.test(name);
  } else {
    return re.test(name);
  }
}

function getPluginsOrPresets(type, opts) {
  const upperCaseType = type.toUpperCase();
  const {
    pkg: { devDependencies, dependencies },
    cwd,
    presets,
    plugins,
    userConfigPresets,
    userConfigPlugins
  } = opts;
  return [
    // opts
    ...((type === PluginType.preset ? presets : plugins) || []),
    // env
    ...(process.env[`MIFAN_${upperCaseType}S`] || '').split(',').filter(Boolean),
    // dependencies
    ...Object.keys(devDependencies || {})
      .concat(Object.keys(dependencies || {}))
      .filter(isPluginOrPreset.bind(null, type)),
    // user config
    ...((type === PluginType.preset ? userConfigPresets : userConfigPlugins) || [])
  ].map(path => resolve.sync(path, { basedir: cwd, extensions: ['.js', '.ts'] }));
}

// e.g.
// initial-state -> initialState
// webpack.css-loader -> webpack.cssLoader
function pkgNameToKey(pkgName, type) {
  // strip none @mifan scope
  if (pkgName.charAt(0) === '@' && !pkgName.startsWith('@mifan/')) {
    pkgName = pkgName.split('/')[1];
  }
  return nameToKey(pkgName.replace(TYPE_RE[type], ''));
}

function nameToKey(name) {
  return name
    .split('.')
    .map(part => lodash.camelCase(part))
    .join('.');
}

function pathToObj({ type, path, cwd }) {
  let pkg = null;
  let isPKGPlugin = false;
  assert(existsSync(path), `${type} ${path} not exists, pathToObj failed`);
  const PKG_JSON_PATH = pkgUp.sync({ cwd });

  if (PKG_JSON_PATH) {
    pkg = require(PKG_JSON_PATH);
    isPKGPlugin = winPath(join(dirname(PKG_JSON_PATH), pkg.main || 'index.js')) === winPath(path);
  }

  let id;
  if (isPKGPlugin) {
    id = pkg.name;
  } else if (winPath(path).startsWith(winPath(cwd))) {
    id = `./${winPath(relative(cwd, path))}`;
  } else if (PKG_JSON_PATH) {
    id = winPath(join(pkg.name, relative(dirname(PKG_JSON_PATH), path)));
  } else {
    id = winPath(path);
  }
  id = id.replace('@mifan/preset-built-in/lib/plugins', '@@');
  id = id.replace(/\.js$/, '');

  const key = isPKGPlugin ? pkgNameToKey(pkg.name, type) : nameToKey(basename(path, extname(path)));
  return {
    id,
    key,
    path: winPath(path),
    apply() {
      // use function to delay require
      try {
        const ret = require(path);
        // use the default member for es modules
        return compatESModuleRequire(ret);
      } catch (e) {
        throw new Error(`Register ${type} ${path} failed, since ${e.message}`);
      }
    },
    defaultConfig: null
  };
}

function resolvePresets(opts) {
  const type = PluginType.preset;
  const presets = [...getPluginsOrPresets(type, opts)];
  return presets.map(path => {
    return pathToObj({
      type,
      path,
      cwd: opts.cwd
    });
  });
}

function resolvePlugins(opts) {
  const type = PluginType.plugin;
  const plugins = getPluginsOrPresets(type, opts);
  return plugins.map(path => {
    return pathToObj({
      type,
      path,
      cwd: opts.cwd
    });
  });
}

function isValidPlugin(plugin) {
  return plugin.id && plugin.key && plugin.apply;
}

function getServicePaths({ cwd, config, env }) {
  let absSrcPath = cwd;
  if (isDirectoryAndExist(join(cwd, 'src'))) {
    absSrcPath = join(cwd, 'src');
  }
  const absViewsPath = join(absSrcPath, 'pages');

  const tmpDir = ['.mifan', env !== 'development' && env].filter(Boolean).join('-');
  return normalizeWithWinPath({
    cwd,
    absNodeModulesPath: join(cwd, 'node_modules'),
    absOutputPath: join(cwd, (config.build && config.build.outputPath) || './dist'),
    absSrcPath,
    absViewsPath,
    absTmpPath: join(absSrcPath, tmpDir)
  });
}

function isDirectoryAndExist(path) {
  return existsSync(path) && statSync(path).isDirectory();
}

function normalizeWithWinPath(obj) {
  return lodash.mapValues(obj, value => winPath(value));
}

module.exports = {
  isPluginOrPreset,
  getPluginsOrPresets,
  pathToObj,
  resolvePresets,
  resolvePlugins,
  isValidPlugin,
  getServicePaths
};
