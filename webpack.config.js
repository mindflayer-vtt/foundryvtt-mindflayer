"use strict";
const path = require("path");
const fs = require("fs");
const ModuleJsonWebpackPlugin = require("./webpack/module-json-plugin");
const CopyPlugin = require("copy-webpack-plugin");
const TerserPlugin = require("terser-webpack-plugin");
const FVTTMacroPackWebpackPlugin = require("./webpack/macro-pack-plugin");

let devDomain = "localhost";
if (fs.existsSync(".devDomain")) {
  devDomain = fs.readFileSync(".devDomain");
}

module.exports = {
  mode: process.env.NODE_ENV == "production" ? "production" : "development",
  entry: "./src/js/index.js",
  output: {
    filename: "MindFlayer.js",
    path: path.resolve(
      __dirname,
      process.env.NODE_ENV == "production"
        ? "dist"
        : "chrome-overrides/" +
            devDomain +
            "/modules/mindflayer-token-controller"
    ),
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: "src/lang", to: "lang" },
        { from: "src/templates", to: "templates" },
        { from: "LICENSE", to: "." },
        { from: "src/style.css", to: "style.css" },
        { from: ".github/foundryvtt-mindflayer-logo.png", to: "assets/images/mindflayer.png" },
      ],
    }),
    new ModuleJsonWebpackPlugin(),
    new FVTTMacroPackWebpackPlugin(),
  ],
  optimization: {
    minimize: process.env.NODE_ENV == "production",
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          keep_classnames: true,
          keep_fnames: true,
        },
      }),
    ],
  },
  devtool: "source-map",
};
