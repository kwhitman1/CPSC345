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
    scheme: 'myapp',
    userInterfaceStyle: 'automatic',
    splash: {
      image: './assets/images/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },
    ios: {
      bundleIdentifier: 'com.aks.appwrnlibapp',
      supportsTablet: true,
    },
    android: {
      package: 'com.aks.appwrnlibapp',
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
    plugins: ['expo-router', 'expo-font', 'expo-secure-store'],
    experiments: {
      typedRoutes: true,
    },
  },
};
