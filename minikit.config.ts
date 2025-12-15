const ROOT_URL = "https://harita-six.vercel.app/"
/**
 * MiniApp configuration object. Must follow the mini app manifest specification.
 *
 * @see {@link https://docs.base.org/mini-apps/features/manifest}
 */
export const minikitConfig = {
  accountAssociation: {
    header: "eyJmaWQiOjExMzg2NzYsInR5cGUiOiJhdXRoIiwia2V5IjoiMHhFODFmMDNDQjY0MjNEOTIzMzE4RjJhQzFlZDUwMjJEZGJFRDhCY0I1In0",
    payload: "eyJkb21haW4iOiJoYXJpdGEtc2l4LnZlcmNlbC5hcHAifQ",
    signature: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAASAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABWhYeYsZIYEUzVFxy6LFdqr-ALvCotIvMFEsUFeb2lDpgoGjQv-_mF1eHujtwBEYNJBQLcxZMTQrV4_8jyDUgBQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAl8ZgIay2xclZzG8RWZzuWvO8j9R0fus3XxDee9lRlVy8dAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACKeyJ0eXBlIjoid2ViYXV0aG4uZ2V0IiwiY2hhbGxlbmdlIjoiY0V0WGRkZE5vZG5yRVVqRlgtb2JIWUdSSnI4cFlGQUZwcFRFQURxUWJKayIsIm9yaWdpbiI6Imh0dHBzOi8va2V5cy5jb2luYmFzZS5jb20iLCJjcm9zc09yaWdpbiI6ZmFsc2V9AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
  },
  baseBuilder: {
    ownerAddress: "0xBa10d1C045Fca9470AC81755062A97df524C2569",
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