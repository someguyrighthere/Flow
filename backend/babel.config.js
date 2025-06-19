// This file explicitly tells Babel how to transpile your test files.
module.exports = {
  presets: [
    // Use preset-env to transpile modern JavaScript for Node.js environments.
    // This allows Mocha to run tests with 'require' syntax correctly.
    "@babel/preset-env"
  ]
};