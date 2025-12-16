import { withValidManifest } from "@coinbase/onchainkit/minikit";
import { minikitConfig } from "../../../minikit.config";

export async function GET() {
  // Önce withValidManifest ile manifest'i al
  const manifest = withValidManifest(minikitConfig);
  
  // imageUrl'i miniapp içinden al ve root seviyeye ekle (Farcaster için gerekli)
  const farcasterJson = {
    ...manifest,
    imageUrl: minikitConfig.miniapp.imageUrl,
  };
  
  return Response.json(farcasterJson);
}