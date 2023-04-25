const path = require("path");

exports.baseConfig = {
  resolve: {
    alias: {
      "bn.js": path.resolve(__dirname, "node_modules/bn.js"),
      "js-sha3": path.resolve(__dirname, "node_modules/js-sha3"),
    },
  },
};
