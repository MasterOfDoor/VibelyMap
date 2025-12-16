import { NextRequest, NextResponse } from "next/server";

// CORS headers
function setCorsHeaders(response: NextResponse) {
  const allowedOrigin = process.env.NEXT_PUBLIC_APP_URL || "*";
  response.headers.set("Access-Control-Allow-Origin", allowedOrigin);
  response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  return response;
}

export async function OPTIONS() {
  const response = new NextResponse(null, { status: 204 });
  return setCorsHeaders(response);
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const address = formData.get("address") as string;

    if (!file) {
      return setCorsHeaders(
        NextResponse.json({ error: "No file provided" }, { status: 400 })
      );
    }

    if (!address) {
      return setCorsHeaders(
        NextResponse.json({ error: "No address provided" }, { status: 400 })
      );
    }

    // Dosya boyutu kontrolü (maksimum 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      return setCorsHeaders(
        NextResponse.json(
          { error: "File size exceeds 5MB limit" },
          { status: 400 }
        )
      );
    }

    // Cloudinary upload
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET;

    if (!cloudName || !uploadPreset) {
      console.warn("[Avatar Upload] Cloudinary credentials not found, falling back to base64");
      // Fallback: Base64 olarak döndür (localStorage için)
      const arrayBuffer = await file.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString("base64");
      const mimeType = file.type || "image/jpeg";
      const dataUrl = `data:${mimeType};base64,${base64}`;
      
      return setCorsHeaders(
        NextResponse.json({
          success: true,
          url: dataUrl,
          storage: "localStorage",
        })
      );
    }

    const cloudinaryFormData = new FormData();
    cloudinaryFormData.append("file", file);
    cloudinaryFormData.append("upload_preset", uploadPreset);
    cloudinaryFormData.append("folder", "vibelymap/avatars");
    cloudinaryFormData.append("public_id", `avatar_${address.toLowerCase()}`);

    const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
    const cloudinaryResponse = await fetch(cloudinaryUrl, {
      method: "POST",
      body: cloudinaryFormData,
    });

    if (!cloudinaryResponse.ok) {
      const error = await cloudinaryResponse.text();
      console.error("[Avatar Upload] Cloudinary error:", error);
      return setCorsHeaders(
        NextResponse.json(
          { error: "Upload failed", detail: error },
          { status: cloudinaryResponse.status }
        )
      );
    }

    const cloudinaryData = await cloudinaryResponse.json();
    const imageUrl = cloudinaryData.secure_url || cloudinaryData.url;

    return setCorsHeaders(
      NextResponse.json({
        success: true,
        url: imageUrl,
        publicId: cloudinaryData.public_id,
        storage: "cloudinary",
      })
    );
  } catch (error: any) {
    console.error("[Avatar Upload] Error:", error);
    return setCorsHeaders(
      NextResponse.json(
        { error: "Upload failed", detail: error.message },
        { status: 500 }
      )
    );
  }
}

