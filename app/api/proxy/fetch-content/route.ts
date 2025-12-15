import { NextRequest, NextResponse } from "next/server";

function setCorsHeaders(response: NextResponse) {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  return response;
}

export async function OPTIONS() {
  const response = new NextResponse(null, { status: 204 });
  return setCorsHeaders(response);
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url") || "";

  if (!url || !/^https?:\/\//i.test(url)) {
    return setCorsHeaders(
      NextResponse.json({ error: "invalid_url" }, { status: 400 })
    );
  }

  // Basic security: block file protocol and local addresses
  try {
    const target = new URL(url);
    if (["file:", "ftp:"].includes(target.protocol)) {
      return setCorsHeaders(
        NextResponse.json({ error: "unsupported_protocol" }, { status: 400 })
      );
    }
  } catch {
    return setCorsHeaders(
      NextResponse.json({ error: "invalid_url" }, { status: 400 })
    );
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      redirect: "follow",
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return setCorsHeaders(
        NextResponse.json(
          { error: "fetch_failed", status: response.status },
          { status: 502 }
        )
      );
    }

    // Limit size to ~200KB to avoid large payloads
    const text = await response.text();
    const limited = text.slice(0, 200_000);

    return setCorsHeaders(
      NextResponse.json({ content: limited }, { status: 200 })
    );
  } catch (error: any) {
    const message =
      error?.name === "AbortError" ? "timeout" : error?.message || "fetch_error";
    return setCorsHeaders(
      NextResponse.json({ error: message }, { status: 502 })
    );
  }
}

