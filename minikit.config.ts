const ROOT_URL = "https://harita-six.vercel.app/"
/**
 * MiniApp configuration object. Must follow the mini app manifest specification.
 *
 * @see {@link https://docs.base.org/mini-apps/features/manifest}
 */
export const minikitConfig = {
  accountAssociation: {
    header: "eyJmaWQiOjE1Nzc1NDYsInR5cGUiOiJjdXN0b2R5Iiwia2V5IjoiMHhGYTgwMUU2OTgwNURCMzZFNTUzMTk0YTVhNWMyOGQwODQ1NEYxMDcxIn0",
    payload: "eyJkb21haW4iOiJ2aWJlbHktbWFwLnZlcmNlbC5hcHAifQ",
    signature: "MHgwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDIwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwNDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMjYwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAyMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwYzAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMTIwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAxNzAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDEwNWFjMDUyNmQyOWVhNGM4NDliM2NlNmYxODE3OWY4Y2RmOTQ0MGE4NDhhNTM5YzczZTNkZTQzMzRmZjliMjRhNjkxZjhhOGQxMDAzYWY5NjEwOTE5MzAwMmI0NGY3YjQ1OThkODBhM2FmMjM3OGZkYTA0Nzg3ZTJhMDIwN2QyMzAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMjVmMTk4MDg2YjJkYjE3MjU2NzMxYmM0NTY2NzNiOTZiY2VmMjNmNTFkMWZiYWNkZDdjNDM3OWVmNjU0NjU1NzJmMWQwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwZjc3YjIyNzQ3OTcwNjUyMjNhMjI3NzY1NjI2MTc1NzQ2ODZlMmU2NzY1NzQyMjJjMjI2MzY4NjE2YzZjNjU2ZTY3NjUyMjNhMjI0NzMwNjYzNjcyNjM0YTUxNjc1NDRlMzI2NDM0NjU3OTRhNGE3NTY0NTAzNjQ0MzE3OTdhNjY0NTZmNjI0ZjQ2NzYzOTZmNjg2MTc1NjU3MTM4MzE0ZDIyMmMyMjZmNzI2OTY3Njk2ZTIyM2EyMjY4NzQ3NDcwNzMzYTJmMmY2YjY1Nzk3MzJlNjM2ZjY5NmU2MjYxNzM2NTJlNjM2ZjZkMjIyYzIyNjM3MjZmNzM3MzRmNzI2OTY3Njk2ZTIyM2E2NjYxNmM3MzY1MmMyMjZmNzQ2ODY1NzI1ZjZiNjU3OTczNWY2MzYxNmU1ZjYyNjU1ZjYxNjQ2NDY1NjQ1ZjY4NjU3MjY1MjIzYTIyNjQ2ZjIwNmU2Zjc0MjA2MzZmNmQ3MDYxNzI2NTIwNjM2YzY5NjU2ZTc0NDQ2MTc0NjE0YTUzNGY0ZTIwNjE2NzYxNjk2ZTczNzQyMDYxMjA3NDY1NmQ3MDZjNjE3NDY1MmUyMDUzNjU2NTIwNjg3NDc0NzA3MzNhMmYyZjY3NmY2ZjJlNjc2YzJmNzk2MTYyNTA2NTc4MjI3ZDAwMDAwMDAwMDAwMDAwMDAwMA"
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