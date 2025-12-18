import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";

// Cloudinary configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

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
    // Check Cloudinary configuration
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      console.error("[Avatar Upload] Cloudinary credentials missing");
      return setCorsHeaders(
        NextResponse.json(
          { error: "Upload service not configured" },
          { status: 500 }
        )
      );
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const address = formData.get("address") as string | null;

    // Validate address
    if (!address || !address.match(/^0x[a-fA-F0-9]{40}$/)) {
      return setCorsHeaders(
        NextResponse.json(
          { error: "Invalid wallet address" },
          { status: 400 }
        )
      );
    }

    // Validate file
    if (!file) {
      return setCorsHeaders(
        NextResponse.json(
          { error: "No file provided" },
          { status: 400 }
        )
      );
    }

    // Check file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return setCorsHeaders(
        NextResponse.json(
          { error: "Invalid file type. Only JPG, PNG, and WebP are allowed." },
          { status: 400 }
        )
      );
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return setCorsHeaders(
        NextResponse.json(
          { error: `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB` },
          { status: 400 }
        )
      );
    }

    // Convert File to Buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Upload to Cloudinary with transformations
    const uploadResult = await new Promise<{
      secure_url: string;
      public_id: string;
    }>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: `profiles/${address.toLowerCase()}`,
          public_id: `avatar_${Date.now()}`,
          resource_type: "image",
          transformation: [
            {
              width: 400,
              height: 400,
              crop: "fill",
              gravity: "face", // Face detection for smart cropping
              quality: "auto",
              format: "auto", // Auto format (WebP when supported)
            },
          ],
          overwrite: true, // Replace existing avatar
          invalidate: true, // Invalidate CDN cache
        },
        (error, result) => {
          if (error) {
            console.error("[Avatar Upload] Cloudinary error:", error);
            reject(error);
          } else if (result) {
            resolve({
              secure_url: result.secure_url,
              public_id: result.public_id,
            });
          } else {
            reject(new Error("Upload failed: No result"));
          }
        }
      );

      uploadStream.end(buffer);
    });

    // Store URL in Redis (via existing pattern)
    // Note: This could be done via a separate endpoint or here
    // For now, we'll return the URL and let the client handle storage

    return setCorsHeaders(
      NextResponse.json({
        success: true,
        url: uploadResult.secure_url,
        publicId: uploadResult.public_id,
        address: address.toLowerCase(),
      })
    );
  } catch (error: any) {
    console.error("[Avatar Upload] Error:", error);
    return setCorsHeaders(
      NextResponse.json(
        {
          error: "Upload failed",
          detail: error.message || "Unknown error",
        },
        { status: 500 }
      )
    );
  }
}

