module.exports = function () {
  return {
    plugins: [
      // register methods
      require.resolve('./plugins/regiserMethods'),

      // register configs
      require.resolve('./plugins/preset'),
      require.resolve('./plugins/plugin'),

      // commands
      require.resolve('./plugins/commands/config'),
      require.resolve('./plugins/commands/plugin')
    ]
  };
};
