import { NextRequest, NextResponse } from "next/server";

const GPT5_API_KEY = process.env.GPT5_API_KEY || process.env.OPENAI_API_KEY || "";

// CORS headers
function setCorsHeaders(response: NextResponse) {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  return response;
}

export async function OPTIONS() {
  const response = new NextResponse(null, { status: 204 });
  return setCorsHeaders(response);
}

export async function POST(request: NextRequest) {
  if (!GPT5_API_KEY) {
    return setCorsHeaders(
      NextResponse.json({ error: "missing_gpt_key" }, { status: 500 })
    );
  }

  try {
    const body = await request.json();
    const { photoUrls, prompt } = body;

    if (!photoUrls || !Array.isArray(photoUrls) || photoUrls.length === 0) {
      return setCorsHeaders(
        NextResponse.json({ error: "missing_photo_urls" }, { status: 400 })
      );
    }

    if (!prompt) {
      return setCorsHeaders(
        NextResponse.json({ error: "missing_prompt" }, { status: 400 })
      );
    }

    // OpenAI Vision API format - messages with image_url
    const content: any[] = [
      { type: "text", text: prompt }
    ];

    // Add images to content
    photoUrls.forEach((base64Data: string) => {
      // Base64 data might already have prefix, ensure it does
      const imageUrl = base64Data.includes("data:image") 
        ? base64Data 
        : `data:image/jpeg;base64,${base64Data}`;
      
      content.push({
        type: "image_url",
        image_url: {
          url: imageUrl
        }
      });
    });

    // OpenAI Chat Completions API request
    const openaiUrl = "https://api.openai.com/v1/chat/completions";
    const openaiRequest = {
      model: "gpt-4o-2024-11-20", // Vision-capable model with specific version
      messages: [
        {
          role: "user",
          content: content
        }
      ],
      max_tokens: 1000,
      response_format: { type: "json_object" } // Force JSON response
    };

    const response = await fetch(openaiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GPT5_API_KEY}`,
      },
      body: JSON.stringify(openaiRequest),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      let error;
      try {
        error = JSON.parse(errorText);
      } catch {
        error = { error: errorText || "Unknown error" };
      }
      
      console.error("[ChatGPT API] Error:", {
        status: response.status,
        statusText: response.statusText,
        error: error,
        requestModel: openaiRequest.model,
        photoCount: photoUrls.length,
        promptLength: prompt.length
      });
      
      return setCorsHeaders(
        NextResponse.json(
          { error: "chatgpt_api_failed", detail: error },
          { status: response.status }
        )
      );
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || "";

    // Parse JSON from response if it's a JSON string
    let outputText = text;
    try {
      // Try to parse as JSON to validate
      const parsed = JSON.parse(text);
      outputText = text; // Keep as string for compatibility
    } catch {
      // Not JSON, use as is
    }

    return setCorsHeaders(
      NextResponse.json({ 
        text: outputText,
        output_text: outputText // Alias for compatibility
      })
    );
  } catch (error: any) {
    console.error("[ChatGPT Proxy] Error:", error);
    return setCorsHeaders(
      NextResponse.json(
        { error: "proxy_failed", detail: error.message },
        { status: 500 }
      )
    );
  }
}

