const { join } = require('path');
const { existsSync, writeFileSync } = require('fs-extra');
const yParser = require('yargs-parser');
const getPackages = require('./utils/getPackages');

(async () => {
  const args = yParser(process.argv);
  const version = require('../lerna.json').version;

  const pkgs = getPackages();

  pkgs.forEach(shortName => {
    const name = shortName === 'mifan' ? shortName : `@assits/mifan-${shortName}`;

    const pkgJSONPath = join(__dirname, '..', 'packages', shortName, 'package.json');
    const pkgJSONExists = existsSync(pkgJSONPath);
    if (args.force || !pkgJSONExists) {
      const json = {
        name,
        version: version !== 'independent' ? version : '0.0.1',
        description: name,
        main: 'lib/index.js',
        files: ['dist', 'lib'],
        keywords: ['mifan'],
        authors: ['mifan'],
        license: 'MIT',
        publishConfig: {
          access: 'public'
        }
      };
      if (pkgJSONExists) {
        const pkg = require(pkgJSONPath);
        [
          'dependencies',
          'devDependencies',
          'peerDependencies',
          'bin',
          'files',
          'authors',
          'types',
          'sideEffects',
          'main',
          'module'
        ].forEach(key => {
          if (pkg[key]) json[key] = pkg[key];
        });
      }
      writeFileSync(pkgJSONPath, `${JSON.stringify(json, null, 2)}\n`);
    }

    if (shortName !== 'mifan') {
      const readmePath = join(__dirname, '..', 'packages', shortName, 'README.md');
      if (args.force || !existsSync(readmePath)) {
        writeFileSync(readmePath, `# ${name}\n`);
      }
    }
  });
})();
