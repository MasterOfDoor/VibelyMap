import { NextResponse } from "next/server";

export async function GET() {
  const envCheck = {
    // Comments Supabase env vars (used for reviews)
    NEXT_PUBLIC_comments_CommentSUPABASE_URL: !!process.env.NEXT_PUBLIC_comments_CommentSUPABASE_URL,
    NEXT_PUBLIC_comments_CommentSUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_comments_CommentSUPABASE_ANON_KEY,
    NEXT_PUBLIC_comments_CommentSUPABASE_PUBLISHABLE_KEY: !!process.env.NEXT_PUBLIC_comments_CommentSUPABASE_PUBLISHABLE_KEY,
    comments_SUPABASE_ANON_KEY: !!process.env.comments_SUPABASE_ANON_KEY,
    comments_SUPABASE_PUBLISHABLE_KEY: !!process.env.comments_SUPABASE_PUBLISHABLE_KEY,
    
    // URL preview
    urlPreview: (process.env.NEXT_PUBLIC_comments_CommentSUPABASE_URL || "NOT_FOUND").substring(0, 50),
  };

  return NextResponse.json(envCheck);
}
