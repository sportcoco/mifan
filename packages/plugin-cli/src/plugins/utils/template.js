const { readFileSync, writeFileSync } = require('fs-extra');
const { join } = require('path');

exports.readTemplateJson = () => {
  return JSON.parse(readFileSync(join(__dirname, '../config/templateGitRepo.json'), 'utf8'));
};

exports.writeTemplateJson = json => {
  return writeFileSync(join(__dirname, '../config/templateGItRepo.json'), JSON.stringify(json), 'utf8');
};
