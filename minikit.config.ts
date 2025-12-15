const ROOT_URL = "https://harita-six.vercel.app/"
/**
 * MiniApp configuration object. Must follow the mini app manifest specification.
 *
 * @see {@link https://docs.base.org/mini-apps/features/manifest}
 */
export const minikitConfig = {
  accountAssociation: {
  "header": "eyJmaWQiOjE1Nzc1NDYsInR5cGUiOiJjdXN0b2R5Iiwia2V5IjoiMHhGYTgwMUU2OTgwNURCMzZFNTUzMTk0YTVhNWMyOGQwODQ1NEYxMDcxIn0",
  "payload": "eyJkb21haW4iOiJ2aWJlbHktbWFwLnZlcmNlbC5hcHAifQ",
  "signature": "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAmAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAASAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABh6Srd3IK3WiyxZsTUGjOQHEs-xG43DUizf92GUVLiNF9_06jhrsqCaGk4C8VFZX2EHpQHUzWrTfL6zGq193DPQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAl8ZgIay2xclZzG8RWZzuWvO8j9R0fus3XxDee9lRlVy8dAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD3eyJ0eXBlIjoid2ViYXV0aG4uZ2V0IiwiY2hhbGxlbmdlIjoic0JQTjVRdk5hcmtlbkZxU1h0WUtXVzZtOWFRd04waEo5eGRQWE9UWlJqRSIsIm9yaWdpbiI6Imh0dHBzOi8va2V5cy5jb2luYmFzZS5jb20iLCJjcm9zc09yaWdpbiI6ZmFsc2UsIm90aGVyX2tleXNfY2FuX2JlX2FkZGVkX2hlcmUiOiJkbyBub3QgY29tcGFyZSBjbGllbnREYXRhSlNPTiBhZ2FpbnN0IGEgdGVtcGxhdGUuIFNlZSBodHRwczovL2dvby5nbC95YWJQZXgifQAAAAAAAAAAAA"
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
    iconUrl: `${ROOT_URL}/logo.png`,
    imageUrl: `${ROOT_URL}/imageurl23.png`,
    splashImageUrl: `${ROOT_URL}/logo.png`,
    splashBackgroundColor: "#d4a657",
    homeUrl: ROOT_URL,
    webhookUrl: `${ROOT_URL}/api/webhook`,
    primaryCategory: "social",
    tags: ["harita", "maps", "places", "location", "base"],
    heroImageUrl: `${ROOT_URL}/imageurl23.png`,
    tagline: "Yakın mekanları keşfet",
    ogTitle: "Harita - Yakın Mekanları Keşfet",
    ogDescription: "Yakın mekanları keşfetmek için Base blockchain üzerinde çalışan harita uygulaması.",
    ogImageUrl: `${ROOT_URL}/imageurl23.png`,
  },
} as const;
