import { NextResponse } from "next/server";

export async function GET() {
  const envCheck = {
    // Supabase URL variants
    NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_comments_CommentSUPABASE_URL: !!process.env.NEXT_PUBLIC_comments_CommentSUPABASE_URL,
    comments_SUPABASE_URL: !!process.env.comments_SUPABASE_URL,
    
    // Supabase Key variants
    NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_comments_CommentSUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_comments_CommentSUPABASE_ANON_KEY,
    comments_SUPABASE_ANON_KEY: !!process.env.comments_SUPABASE_ANON_KEY,
    comments_SUPABASE_PUBLISHABLE_KEY: !!process.env.comments_SUPABASE_PUBLISHABLE_KEY,
    
    // URL preview (first 40 chars)
    urlPreview: (
      process.env.NEXT_PUBLIC_SUPABASE_URL || 
      process.env.NEXT_PUBLIC_comments_CommentSUPABASE_URL ||
      process.env.comments_SUPABASE_URL ||
      "NOT_FOUND"
    ).substring(0, 40),
  };

  return NextResponse.json(envCheck);
}
