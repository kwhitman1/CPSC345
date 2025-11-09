module.exports = function (api) {
  api.cache(true);
  return {
    // nativewind exposes a babel config (with nested plugins), so add it
    // as a preset rather than a plugin to avoid Babel validation errors.
    presets: ['babel-preset-expo', 'nativewind/babel'],
    plugins: [],
  };
};
     
