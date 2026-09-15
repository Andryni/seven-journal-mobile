/* eslint-disable */
/**
 * Stand-in for lucide-react-native.
 *
 * The published package is ESM-only (.mjs) and re-exports well over a thousand
 * icons, so transforming it costs seconds per suite to render glyphs that are
 * decorative in these tests.
 *
 * Any icon name resolves to a bare View carrying a testID, so a test can still
 * assert an icon is present without the package being loaded.
 */
const React = require('react');
const { View } = require('react-native');

module.exports = new Proxy(
  {},
  {
    get(_target, name) {
      if (name === '__esModule') return true;
      if (name === 'default') return undefined;
      const Icon = props =>
        React.createElement(View, { testID: `icon-${String(name)}`, ...props });
      Icon.displayName = String(name);
      return Icon;
    },
  }
);
