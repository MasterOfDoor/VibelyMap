import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Create Supabase client for Comments database
function getSupabaseClient() {
  // Comments Supabase env variable names (from Vercel)
  const supabaseUrl = process.env.NEXT_PUBLIC_comments_CommentSUPABASE_URL;
  const supabaseAnonKey = 
    process.env.NEXT_PUBLIC_comments_CommentSUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_comments_CommentSUPABASE_PUBLISHABLE_KEY ||
    process.env.comments_SUPABASE_ANON_KEY ||
    process.env.comments_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(`Comments Supabase credentials missing. URL: ${!!supabaseUrl}, Key: ${!!supabaseAnonKey}`);
  }

  return createClient(supabaseUrl, supabaseAnonKey);
}

/*
  Supabase Table Schema - Run this SQL in Supabase SQL Editor:

  CREATE TABLE reviews (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    place_id TEXT NOT NULL,
    reviewer_address TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT NOT NULL,
    detailed_ratings JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );

  CREATE INDEX idx_reviews_place_id ON reviews(place_id);
  CREATE INDEX idx_reviews_reviewer ON reviews(reviewer_address);
*/

function setCorsHeaders(response: NextResponse) {
  const allowedOrigin = process.env.NEXT_PUBLIC_APP_URL || "*";
  response.headers.set("Access-Control-Allow-Origin", allowedOrigin);
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  return response;
}

export async function OPTIONS() {
  const response = new NextResponse(null, { status: 204 });
  return setCorsHeaders(response);
}

// GET: Get reviews by placeId OR by reviewerAddress
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const placeId = searchParams.get("placeId");
    const reviewerAddress = searchParams.get("reviewerAddress");

    if (!placeId && !reviewerAddress) {
      return setCorsHeaders(
        NextResponse.json({ error: "placeId or reviewerAddress is required" }, { status: 400 })
      );
    }

    const supabase = getSupabaseClient();

    let query = supabase.from("reviews").select("*");

    if (placeId) {
      // Get reviews for a specific place
      query = query.eq("place_id", placeId);
    } else if (reviewerAddress) {
      // Get reviews by a specific user (for profile)
      const normalizedAddress = reviewerAddress.toLowerCase();
      query = query.eq("reviewer_address", normalizedAddress);
    }

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) {
      console.error("[Reviews API] Supabase error:", error);
      throw error;
    }

    return setCorsHeaders(NextResponse.json({ reviews: data || [] }));
  } catch (error: any) {
    console.error("[Reviews API] GET error:", error);
    return setCorsHeaders(
      NextResponse.json({ error: "Failed to fetch reviews", detail: error.message }, { status: 500 })
    );
  }
}

// POST: Create a new review
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { placeId, reviewerAddress, rating, comment, detailedRatings } = body;

    // Validate required fields
    if (!placeId || typeof placeId !== "string") {
      return setCorsHeaders(
        NextResponse.json({ error: "placeId is required" }, { status: 400 })
      );
    }

    if (!reviewerAddress || !reviewerAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      return setCorsHeaders(
        NextResponse.json({ error: "Invalid wallet address" }, { status: 400 })
      );
    }

    if (!rating || typeof rating !== "number" || rating < 1 || rating > 5) {
      return setCorsHeaders(
        NextResponse.json({ error: "Rating must be between 1 and 5" }, { status: 400 })
      );
    }

    if (!comment || typeof comment !== "string" || comment.trim().length === 0) {
      return setCorsHeaders(
        NextResponse.json({ error: "Comment is required" }, { status: 400 })
      );
    }

    const normalizedAddress = reviewerAddress.toLowerCase();

    const supabase = getSupabaseClient();

    // Insert the review
    const { data: review, error } = await supabase
      .from("reviews")
      .insert({
        place_id: placeId,
        reviewer_address: normalizedAddress,
        rating: rating,
        comment: comment.trim(),
        detailed_ratings: detailedRatings || null,
      })
      .select()
      .single();

    if (error) {
      console.error("[Reviews API] Insert error:", error);
      throw error;
    }

    return setCorsHeaders(NextResponse.json({ success: true, review }));
  } catch (error: any) {
    console.error("[Reviews API] POST error:", error);
    return setCorsHeaders(
      NextResponse.json({ error: "Failed to create review", detail: error.message }, { status: 500 })
    );
  }
}
