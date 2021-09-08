module.exports = {
  root: true,
  extends: ['plugin:vue/essential', 'eslint:recommended', 'standard', 'plugin:prettier/recommended'],
  plugins: ['vue'],
  env: {
    browser: true,
    es6: true,
    node: true
  },
  parserOptions: {
    parser: 'babel-eslint',
    ecmaVersion: 2021,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true
    }
  },
  globals: {
    uni: 'readonly',
    plus: 'readonly',
    wx: 'readonly',
    my: 'readonly',
    swan: 'readonly'
  },
  rules: {}
};
