import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import eslintConfigPrettier from 'eslint-config-prettier/flat';

// eslint-config-next already registers the jsx-a11y plugin with 6 rules.
// Add the remaining recommended rules without re-registering the plugin.
const nextA11yRules = new Set([
  'jsx-a11y/alt-text',
  'jsx-a11y/aria-props',
  'jsx-a11y/aria-proptypes',
  'jsx-a11y/aria-unsupported-elements',
  'jsx-a11y/role-has-required-aria-props',
  'jsx-a11y/role-supports-aria-props',
]);

const extraA11yRules = Object.fromEntries(
  Object.entries(jsxA11y.flatConfigs.recommended.rules).filter(
    ([key]) => key.startsWith('jsx-a11y/') && !nextA11yRules.has(key)
  )
);

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: extraA11yRules,
  },
  eslintConfigPrettier,
  {
    ignores: ['.next/', 'out/', 'build/', 'dist/', 'drizzle/', 'node_modules/'],
  },
];

export default eslintConfig;
