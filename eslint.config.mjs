import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = defineConfig([
  ...nextVitals,

  // Ignore generated, build, and example files
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "src/generated/**",
    "node_modules/**",
    "src/app/sentry-example-page/**",
    "src/app/api/sentry-example-api/**",
  ]),

  // Project-specific rule overrides
  // CLI scripts (seed, migrations) can use console freely
  {
    files: ["prisma/**/*.ts", "scripts/**/*.ts"],
    rules: {
      "no-console": "off",
    },
  },
]);

export default eslintConfig;
