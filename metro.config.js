// Learn more: https://docs.expo.dev/guides/customizing-metro/
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

/**
 * The EA ships WITH the app.
 *
 * `assets/ea/SevenJournalSync.mq5` is the same file as `bridge/mt5/` in the
 * repository, bundled so the trader can receive it from the connector screen
 * (share sheet → save, mail, cloud) instead of downloading it on a desktop.
 * That is the difference between an app that TELLS you your terminal is too old
 * and one that lets you fix it: the version warning already existed, and the
 * update still required a PC.
 *
 * `.mq5` is not an asset extension Metro knows, and an unregistered extension
 * is not a build error — the file simply is not found at runtime, which is a
 * silent failure. Registering it here is what makes it real.
 */
config.resolver.assetExts.push('mq5');

module.exports = config;
