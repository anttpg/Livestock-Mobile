import js from "@eslint/js";
import globals from "globals";
import pluginReact from "eslint-plugin-react";

export default [
  js.configs.recommended,
  {
    files: ["**/*.{js,mjs,cjs,jsx}"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,  // Add Node.js globals like require, process, __dirname, etc.
      },
    },
    rules: {
      "no-undef": "error",
      "no-unused-vars": "warn",
      "prop-types": "warn",
    },
  },
  pluginReact.configs.flat.recommended,
];