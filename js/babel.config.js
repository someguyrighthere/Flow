// This file explicitly tells Babel how to transpile your test files and source code.
module.exports = {
  presets: [
    // Use preset-env to transpile modern JavaScript for Node.js environments.
    "@babel/preset-env"
  ],
  plugins: [
    // NEW: Add this plugin to support modern syntax like optional chaining (`?.`).
    // This resolves the 'optionalChainingAssign' build error.
    "@babel/plugin-proposal-optional-chaining"
  ]
};
