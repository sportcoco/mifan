const chalk = require('chalk');
const Metalsmith = require('metalsmith');
const nunjucks = require('nunjucks');
const async = require('async');
const path = require('path');
const multimatch = require('multimatch');
const match = require('minimatch');
const getOptions = require('./utils/options');
const ask = require('./utils/ask');
const evaluate = require('./utils/eval');
const logger = require('./utils/logger');
const exists = require('fs-extra').existsSync;

// 配置变量插值标签，以免与小程序动态绑定语法冲突
nunjucks.configure({
  tags: {
    variableStart: '<$',
    variableEnd: '$>'
  },
  autoescape: false,
  trimBlocks: true,
  lstripBlocks: true
});

const render = nunjucks.renderString;

/**
 * Generate a template given a `src` and `dest`.
 *
 * @param {Object} option
 * @param {String} option.name
 * @param {String} option.src
 * @param {String} option.dest
 * @param {Array} option.mockList
 * @param {Function} done
 */

module.exports = function generate({ name, src, dest, mockList }, done) {
  const opts = getOptions(name, src);
  const tmpPath = path.join(src, 'template');
  const metalsmith = Metalsmith(exists(tmpPath) ? tmpPath : src);
  const data = Object.assign(metalsmith.metadata(), {
    name,
    destDirName: name,
    inPlace: dest === process.cwd(),
    noEscape: true
  });

  const helpers = { chalk, logger };

  if (opts.metalsmith && typeof opts.metalsmith.before === 'function') {
    opts.metalsmith.before(metalsmith, opts, helpers);
  }

  const mockData = opts.getMockData && opts.getMockData(mockList);

  const chain = mockData ? metalsmith.use(mock(mockData)) : metalsmith.use(askQuestions(opts.prompts));

  chain
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
    .clean(false)
    .source('.') // start from template root instead of `./src` which is Metalsmith's default for `source`
    .destination(dest)
    .build((err, files) => {
      done(err);
      if (typeof opts.complete === 'function') {
        const helpers = { chalk, logger, files };
        opts.complete(data, helpers);
      } else {
        logMessage(opts.completeMessage, data);
      }
    });

  return data;
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

function mock(mockData) {
  return (files, metalsmith, done) => {
    processMock(mockData, metalsmith.metadata(), done);
  };
}

function processMock(mockData, data, done) {
  if (!mockData) {
    return done();
  }
  Object.assign(data, mockData);
  done();
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
        if (match(file, glob, { dot: true })) {
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
        const str = files[file].contents.toString();
        render(str, metalsmithMetadata, (err, res) => {
          if (err) {
            err.message = `[${file}] ${err.message}`;
            return next(err);
          }
          files[file].contents = Buffer.from(res);
          next();
        });
      },
      done
    );
  };
}

/**
 * Display template complete message.
 *
 * @param {String} message
 * @param {Object} data
 */

function logMessage(message, data) {
  if (!message) return;
  render(message, data, (err, res) => {
    if (err) {
      console.error('\n   Error when rendering template complete message: ' + err.message.trim());
    } else {
      console.log(
        '\n' +
          res
            .split(/\r?\n/g)
            .map(line => '   ' + line)
            .join('\n')
      );
    }
  });
}
