// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'android/*', 'ios/*', 'node_modules/*', '.expo/*'],
  },
  {
    rules: {
      /**
       * ERROR, not warn. A hook placed after an early return runs on some
       * renders and not others, so React throws "Rendered fewer hooks than
       * expected" and kills the JS thread — the user sees "DISTRO keeps
       * stopping", not a broken screen. That shipped in 1.1.3 via a useRef
       * added below `if (!buyer) return null` in SalesCheckoutScreen, and
       * nothing in CI could have caught it because the project had no linter.
       */
      'react-hooks/rules-of-hooks': 'error',
    },
  },
]);
