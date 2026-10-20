import globals from "globals";

export default [
  { ignores: ["node_modules/**", "disabled_scripts/**", "dist/**", "vendor/**", "test-results/**", "playwright-report/**"] },
  { files: ["gtnhflow-pyodide-worker.js", "service-worker.js"], languageOptions: { globals: globals.worker } },
  {
    files: ["*.js", "tests/**/*.js", "tools/**/*.js"],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      "no-undef": "error",
      "no-dupe-args": "error",
      "no-dupe-keys": "error",
      "no-unreachable": "error",
      "constructor-super": "error",
      "valid-typeof": "error"
    }
  },
  {
    files: ["production-engine.js", "machine-*.js", "factory-*.js", "recipe-data.js", "recipe-export.js", "recipe-compare.js", "recipe-details.js", "version-compare-ui.js", "plan-*.js", "planner*.js", "maker*.js", "materialcalc.js", "datasets.js", "repository-loader.js", "search-controls.js"],
    rules: { "no-unused-vars": ["error", { args: "none", caughtErrors: "none" }] }
  }
];
