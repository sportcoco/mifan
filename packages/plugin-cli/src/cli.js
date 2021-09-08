const { yParser } = require('@bomijs/utils');
const { join, isAbsolute } = require('path');
const { Service: CoreService } = require('@assits/mifan-core');

class Service extends CoreService {
  constructor(opts = {}) {
    super({
      ...opts,
      presets: [require.resolve('@assits/mifan-preset-built-in'), ...(opts.presets || [])],
      plugins: [...(opts.plugins || [])]
    });
  }
}

function getCWD() {
  const cwd = process.cwd();
  if (process.env.APP_ROOT) {
    // avoid repeat cwd path
    if (!isAbsolute(process.env.APP_ROOT)) {
      return join(cwd, process.env.APP_ROOT);
    }
    return process.env.APP_ROOT;
  }
  return cwd;
}

(async () => {
  const args = yParser(process.argv.slice(2));
  const name = args._[0];
  const service = new Service({ cwd: getCWD() });

  service.run({ name, args }).catch(err => {
    console.error(err);
    process.exit(1);
  });
})();
