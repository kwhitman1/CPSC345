// Export an app config that conditionally includes the
// expo-alternate-app-icons plugin only if the package is installed.
// This prevents a PluginError during development when the package
// has not yet been added.
const basePlugins = ['expo-router', 'expo-font', 'expo-secure-store'];

let plugins = [...basePlugins];
// Add the plugin only when the environment explicitly allows it.
// Set EXPO_ALLOW_ALTERNATE_ICONS=1 when you want to prebuild with this
// plugin and run a development/native build. This prevents Expo Go from
// attempting to load a native module that isn't present.
if (process.env.EXPO_ALLOW_ALTERNATE_ICONS === '1' || process.env.EXPO_ALLOW_ALTERNATE_ICONS === 'true') {
  try {
    require.resolve('expo-alternate-app-icons');
    plugins.push([
      'expo-alternate-app-icons',
      [
        // Using existing images in assets/images as placeholders so prebuild
        // succeeds. Replace these with dedicated app-icons when you have them.
        {
          name: 'IconA',
          ios: './assets/images/icon.png',
          android: { foregroundImage: './assets/images/adaptive-icon.png', backgroundColor: '#001413' },
        },
        {
          name: 'IconB',
          ios: './assets/images/icon.png',
          android: { foregroundImage: './assets/images/adaptive-icon.png', backgroundColor: '#ffffff' },
        },
      ],
    ]);
  } catch (e) {
    // plugin not installed or not resolvable; skip adding it
    console.warn('expo-alternate-app-icons not installed; skipped plugin');
  }
} else {
  // No env var set; keep plugins minimal so Expo Go can run without native module.
}

module.exports = {
  expo: {
    extra: {
      eas: {
        projectId: '57066c42-6a81-40f8-8e5a-a44fde655b91',
      }
    },
    name: 'firebase-rn-lib-app',
    slug: 'firebase-rn-lib-app',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
  scheme: 'scavengerhunt',
    userInterfaceStyle: 'automatic',
    splash: {
      image: './assets/images/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },
    ios: {
      bundleIdentifier: 'com.aks.appwrnlibapp',
      associatedDomains: [
        // Add your universal link domains here, e.g. 'applinks:example.com'
      ],
      supportsTablet: true,
    },
    android: {
      package: 'com.aks.appwrnlibapp',
      intentFilters: [
        {
          action: 'VIEW',
          data: [
            {
              scheme: 'https',
              host: 'example.com',
              pathPrefix: '/hunt'
            },
            {
              scheme: 'scavengerhunt'
            }
          ],
          category: ['BROWSABLE', 'DEFAULT']
        }
      ],
      adaptiveIcon: {
        foregroundImage: './assets/images/adaptive-icon.png',
        backgroundColor: '#ffffff',
      },
    },
    web: {
      bundler: 'metro',
      output: 'static',
      favicon: './assets/images/favicon.png',
    },
    plugins,
    experiments: {
      typedRoutes: true,
    },
  },
};
