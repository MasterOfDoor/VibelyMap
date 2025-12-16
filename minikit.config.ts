const ROOT_URL = "https://vibely-map.vercel.app"
/**
 * MiniApp configuration object. Must follow the mini app manifest specification.
 *
 * @see {@link https://docs.base.org/mini-apps/features/manifest}
 */
export const minikitConfig = {
  accountAssociation: {
  "header": "eyJmaWQiOjE1Nzc1NDYsInR5cGUiOiJhdXRoIiwia2V5IjoiMHhGYTgwMUU2OTgwNURCMzZFNTUzMTk0YTVhNWMyOGQwODQ1NEYxMDcxIn0",
  "payload": "eyJkb21haW4iOiJ2aWJlbHktbWFwLnZlcmNlbC5hcHAifQ",
  "signature": "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAASAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABxFy1tTbgf3iTah5vanTsCzlJofoUBcRJrKNL0_UaWCI2akYq-vXBQ42g_Z6XU1_HWMQqWHpWTu8UIyDqtZTbhAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAl8ZgIay2xclZzG8RWZzuWvO8j9R0fus3XxDee9lRlVy8dAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACKeyJ0eXBlIjoid2ViYXV0aG4uZ2V0IiwiY2hhbGxlbmdlIjoic0JQTjVRdk5hcmtlbkZxU1h0WUtXVzZtOWFRd04waEo5eGRQWE9UWlJqRSIsIm9yaWdpbiI6Imh0dHBzOi8va2V5cy5jb2luYmFzZS5jb20iLCJjcm9zc09yaWdpbiI6ZmFsc2V9AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
},
  baseBuilder: {
    ownerAddress: "0xFa801E69805DB36E553194a5a5c28d08454F1071",
  },
  miniapp: {
    version: "1",
    name: "Harita",
    subtitle: "Mekanları keşfet",
    description: "Yakın mekanları keşfetmek için Base blockchain üzerinde çalışan harita uygulaması.",
    screenshotUrls: [],
    iconUrl: `${ROOT_URL}/v.png`,
    imageUrl: `${ROOT_URL}/a.png`,
    splashImageUrl: `${ROOT_URL}/a.png`,
    splashBackgroundColor: "#d4a657",
    homeUrl: ROOT_URL,
    webhookUrl: `${ROOT_URL}/api/webhook`,
    primaryCategory: "social",
    tags: ["harita", "maps", "places", "location", "base"],
    heroImageUrl: `${ROOT_URL}/v.png`,
    tagline: "Yakın mekanları keşfet",
    ogTitle: "Hislerine göre keşfet",
    ogDescription: "Hislere göre keşfetmek için Base blockchain üzerinde çalışan harita uygulaması.",
    ogImageUrl: `${ROOT_URL}/imageurl23.png`,
  },
} as const;
