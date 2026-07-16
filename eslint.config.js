import eslintConfigPrettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";

const typedFiles = ["src/**/*.ts", "tests/**/*.ts"];
const safeDomMessage = "Use textContent or safe DOM APIs instead (DESIGN §12.3).";
const noEvalMessage = "Dynamic code evaluation is forbidden (DESIGN §12.3).";

export default tseslint.config(
  {
    ignores: ["coverage/**", "dist/**"],
  },
  ...tseslint.configs.recommendedTypeChecked.map((config) => ({
    ...config,
    files: typedFiles,
  })),
  {
    files: typedFiles,
    linterOptions: {
      noInlineConfig: true,
    },
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "no-eval": "error",
      "no-new-func": "error",
      "no-restricted-globals": ["error", { name: "eval", message: noEvalMessage }],
      "no-restricted-properties": [
        "error",
        { property: "innerHTML", message: safeDomMessage },
        { property: "outerHTML", message: safeDomMessage },
        { property: "insertAdjacentHTML", message: safeDomMessage },
        { object: "document", property: "write", message: safeDomMessage },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector:
            ":matches(CallExpression, NewExpression)[callee.type='MemberExpression']:matches([callee.object.name='window'], [callee.object.name='globalThis']):matches([callee.computed=false][callee.property.name='Function'], [callee.computed=true][callee.property.value='Function'])",
          message: noEvalMessage,
        },
        {
          selector: "CallExpression[callee.type='MemberExpression'][callee.property.name='eval']",
          message: noEvalMessage,
        },
        {
          selector:
            "CallExpression[callee.type='MemberExpression'][callee.computed=true][callee.property.value='eval']",
          message: noEvalMessage,
        },
        {
          selector:
            "CallExpression[callee.type='MemberExpression'][callee.object.type='MemberExpression'][callee.object.object.name='window']:matches([callee.object.computed=false][callee.object.property.name='document'], [callee.object.computed=true][callee.object.property.value='document']):matches([callee.computed=false][callee.property.name='write'], [callee.computed=true][callee.property.value='write'])",
          message: safeDomMessage,
        },
      ],
    },
  },
  {
    ...eslintConfigPrettier,
    files: typedFiles,
  },
);
