const ROOT_URL = "https://vibely-map.vercel.app"
/**
 * MiniApp configuration object. Must follow the mini app manifest specification.
 *
 * @see {@link https://docs.base.org/mini-apps/features/manifest}
 */
export const minikitConfig = {
  accountAssociation: {
  "header": "eyJmaWQiOjE2MTcxMDUsInR5cGUiOiJhdXRoIiwia2V5IjoiMHhCQWQ3RTQ0YmJhMjA2RUZhZjdhMEVGMDhjNUMyMzhBNTY3QjQ2RGU1In0",
  "payload": "eyJkb21haW4iOiJ2aWJlbHktbWFwLnZlcmNlbC5hcHAifQ",
  "signature": "zEQQv/aiNGoz/wWFXBYdsLEU9fIk0XYoM3iHf/zeDw9I4ZVPHncvmgabyXapUZO+clDrC6t+6RiYaEhRw6pBexs="
},
  baseBuilder: {
    ownerAddress: "0xFa801E69805DB36E553194a5a5c28d08454F1071",
  },
  miniapp: {
    version: "1",
    name: "VibelyMap",
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
