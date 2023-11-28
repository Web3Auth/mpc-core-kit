const path = require("path");
const TerserPlugin = require("terser-webpack-plugin");

exports.baseConfig = {
  resolve: {
    alias: {
      "bn.js": path.resolve(__dirname, "node_modules/bn.js"),
      "js-sha3": path.resolve(__dirname, "node_modules/js-sha3"),
    },
  },
  optimization: {
    minimize: true,
    minimizer: [new TerserPlugin()],
  },
};
