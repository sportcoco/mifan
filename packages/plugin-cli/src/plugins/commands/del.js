import { init } from '../utils/init';

module.exports = api => {
  api.registerCommand({
    name: 'init',
    description: 'init a new project from a template',
    details: `
      -c, --clone', 'use git clone
      -r, --run', 'run the project
    `.trim(),
    fn({ args }) {
      init(args);
    }
  });
};
