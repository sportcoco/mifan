const Metalsmith = require('metalsmith');
const ArtTemplate = require('art-template');
const async = require('async');
const multimatch = require('multimatch');
const minimatch = require('minimatch');
const ask = require('./utils/ask');
const evaluate = require('./utils/eval');
const stripJsonComment = require('./utils/stripJsonComment');
const assert = require('assert');

// 配置变量插值标签，以免与小程序动态绑定语法冲突
ArtTemplate.defaults.rules.forEach(rule => {
  rule.test = new RegExp(rule.test.source.replace('{{', '<\\$').replace('}}', '\\$>'));
});
// 关闭转义
ArtTemplate.defaults.escape = false;

module.exports = api => {
  ['onGenerateFiles', 'addTmpGenerateWatcherPaths'].forEach(name => {
    api.registerMethod({ name });
  });

  api.registerMethod({
    name: 'generate',
    fn({ source, target, options }, done) {
      assert(api.stage >= api.ServiceStage.pluginReady, `api.generate() should not execute in register stage.`);
      const opts = options;
      const metalsmith = Metalsmith(source);
      const data = Object.assign(metalsmith.metadata(), {
        inPlace: target === process.cwd()
      });
      const helpers = {
        async,
        assert,
        minimatch,
        multimatch,
        stripJsonComment,
        ArtTemplate
      };

      if (target) {
        metalsmith.destination(target);
      }

      if (!opts.prompts) {
        opts.prompts = {};
      }

      if (opts.imports && typeof opts.imports === 'object') {
        Object.keys(opts.imports).forEach(key => {
          ArtTemplate.defaults.imports[key] = opts.imports[key];
        });
      }

      if (opts.metalsmith && typeof opts.metalsmith.before === 'function') {
        opts.metalsmith.before(metalsmith, opts, helpers);
      }

      metalsmith
        .use(askQuestions(opts.prompts))
        .use(useDefault(opts.prompts))
        .use(computed(opts.computed))
        .use(filterFiles(opts.filters))
        .use(renderTemplateFiles(opts.skipInterpolation));

      if (typeof opts.metalsmith === 'function') {
        opts.metalsmith(metalsmith, opts, helpers);
      } else if (opts.metalsmith && typeof opts.metalsmith.after === 'function') {
        opts.metalsmith.after(metalsmith, opts, helpers);
      }

      metalsmith
        .clean(true)
        .source('.') // start from template root instead of `./src` which is Metalsmith's default for `source`
        .build((err, files) => {
          done(err);
          if (typeof opts.complete === 'function') {
            opts.complete(files, data, helpers);
          }
        });
    }
  });
};

/**
 * Create a middleware for asking questions.
 *
 * @param {Object} prompts
 * @return {Function}
 */

function askQuestions(prompts) {
  return (files, metalsmith, done) => {
    ask(prompts, metalsmith.metadata(), done);
  };
}

function useDefault(prompts) {
  return (files, metalsmith, done) => {
    const data = metalsmith.metadata();
    Object.keys(prompts).forEach(key => {
      const prompt = prompts[key];
      // eslint-disable-next-line
      if (!data.hasOwnProperty(key) && prompt.hasOwnProperty('default')) {
        if (typeof prompt.default === 'function') {
          data[key] = prompt.default(data);
        } else {
          data[key] = prompt.default;
        }
      }
    });
    done();
  };
}

function computed(computed) {
  return (files, metalsmith, done) => {
    processComputed(computed, metalsmith.metadata(), done);
  };
}

function processComputed(computed, data, done) {
  if (!computed) {
    return done();
  }
  Object.keys(computed).forEach(key => {
    Object.defineProperty(data, key, {
      get() {
        return computed[key].call(data);
      },
      enumerable: true
    });
  });
  done();
}

/**
 * Create a middleware for filtering files.
 *
 * @param {Object} filters
 * @return {Function}
 */

function filterFiles(filters) {
  return (files, metalsmith, done) => {
    if (!filters) {
      return done();
    }
    const fileNames = Object.keys(files);
    Object.keys(filters).forEach(glob => {
      fileNames.forEach(file => {
        if (minimatch(file, glob, { dot: true })) {
          const condition = filters[glob];
          if (!evaluate(condition, metalsmith.metadata())) {
            delete files[file];
          }
        }
      });
    });
    done();
  };
}

/**
 * Template in place plugin.
 *
 * @param {Object} files
 * @param {Metalsmith} metalsmith
 * @param {Function} done
 */

function renderTemplateFiles(skipInterpolation) {
  // Ignore images by default
  const skipImage = ['**/**.{png,jpg,jpeg,gif,webp,apng,bpg,bmp,tif}'];
  // Ignore font by default
  const skipFont = ['**/**.{svg,svgz,eot,otf,ttf}'];

  skipInterpolation = typeof skipInterpolation === 'string' ? [skipInterpolation] : skipInterpolation || [];

  skipInterpolation = [...skipImage, ...skipFont, ...skipInterpolation];

  return (files, metalsmith, done) => {
    const keys = Object.keys(files);
    const metalsmithMetadata = metalsmith.metadata();
    async.each(
      keys,
      (file, next) => {
        // skipping files with skipInterpolation option
        if (skipInterpolation && multimatch([file], skipInterpolation, { dot: true }).length) {
          return next();
        }

        try {
          const str = files[file].contents.toString();
          const res = ArtTemplate.render(str, metalsmithMetadata);
          files[file].contents = Buffer.from(res);
          next();
        } catch (err) {
          err.message = `[${file}] ${err.message}`;
          next(err);
        }
      },
      done
    );
  };
}
