const fs = require("fs");
const packageJson = require("../package.json");

class ModuleJsonWebpackPlugin {
  static defaultOptions = {
    srcFile: "src/module.tmpl.json",
    outputFile: "module.json",
  };
  constructor(options = {}) {
    this.options = { ...ModuleJsonWebpackPlugin.defaultOptions, ...options };
  }
  apply(compiler) {
    const pluginName = ModuleJsonWebpackPlugin.name;
    const { webpack } = compiler;
    const { Compilation } = webpack;
    const { RawSource } = webpack.sources;
    compiler.hooks.thisCompilation.tap(pluginName, (compilation) => {
      compilation.hooks.processAssets.tap(
        {
          name: pluginName,
          stage: Compilation.PROCESS_ASSETS_STAGE_SUMMARIZE,
        },
        (assets) => {
          const content = JSON.parse(
            fs
              .readFileSync(this.options.srcFile)
              .toString()
              .replaceAll("{{version}}", packageJson.version),
          );
          content.version = packageJson.version;

          // Adding new asset to the compilation, so it would be automatically
          // generated by the webpack in the output directory.
          compilation.emitAsset(
            this.options.outputFile,
            new RawSource(JSON.stringify(content)),
          );
        },
      );
    });
  }
}

module.exports = ModuleJsonWebpackPlugin;
