import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // The React Compiler "rules of React" lints (purity / refs / immutability /
    // set-state-in-effect) ship as errors in eslint-plugin-react-hooks v6, but
    // this project does not run the React Compiler. They flag intentional,
    // correct patterns here — e.g. Math.random() inside useMemo for procedural
    // 3D geometry and ref mutation inside useFrame (the core React Three Fiber
    // animation model). Kept as warnings so genuine issues still surface
    // without failing the build.
    rules: {
      "react-hooks/purity": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
