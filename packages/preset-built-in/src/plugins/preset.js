module.exports = api => {
  api.describe({
    key: 'presets',
    config: {
      schema(joi) {
        return joi.array().items(joi.string());
      }
    }
  });
};
