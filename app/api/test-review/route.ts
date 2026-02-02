import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  try {
    const supabaseUrl = 
      process.env.NEXT_PUBLIC_SUPABASE_URL || 
      process.env.NEXT_PUBLIC_comments_CommentSUPABASE_URL ||
      process.env.comments_SUPABASE_URL;

    const supabaseAnonKey = 
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
      process.env.NEXT_PUBLIC_comments_CommentSUPABASE_ANON_KEY ||
      process.env.comments_SUPABASE_ANON_KEY ||
      process.env.comments_SUPABASE_PUBLISHABLE_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: "Missing credentials" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Test insert
    const testReview = {
      place_id: "test_place_123",
      reviewer_address: "0x1234567890123456789012345678901234567890",
      rating: 5,
      comment: "Test review from API - " + new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("reviews")
      .insert(testReview)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ 
        success: false, 
        error: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      }, { status: 500 });
    }

    // Clean up test data
    await supabase.from("reviews").delete().eq("id", data.id);

    return NextResponse.json({ 
      success: true, 
      message: "Test review inserted and deleted successfully",
      reviewId: data.id,
    });
  } catch (err: any) {
    return NextResponse.json({ 
      success: false, 
      error: err.message,
    }, { status: 500 });
  }
}
