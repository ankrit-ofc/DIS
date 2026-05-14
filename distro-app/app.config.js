const config = require("./app.json");
const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || "";

module.exports = {
  ...config,
  expo: {
    ...config.expo,
    ios: {
      ...config.expo.ios,
      config: {
        googleMapsApiKey: GOOGLE_MAPS_API_KEY,
      },
    },
    android: {
      ...config.expo.android,
      config: {
        googleMaps: {
          apiKey: GOOGLE_MAPS_API_KEY,
        },
      },
    },
    extra: {
      eas: {
        projectId: "d2689199-0507-42db-959c-38c7b450bd2b",
      },
    },
  },
};