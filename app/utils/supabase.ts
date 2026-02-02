import { createClient } from "@supabase/supabase-js";

// ============================================
// 1. USERNAME/PROFILES Database (username project)
// ============================================
const profilesUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder-url.supabase.co";
const profilesKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key";

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  console.warn("Profiles Supabase URL missing. Profile operations will fail.");
}

// Default export - used for profiles/username operations
export const supabase = createClient(profilesUrl, profilesKey);

// ============================================
// 2. COMMENTS/REVIEWS Database (Comments project)
// ============================================
const commentsUrl = process.env.NEXT_PUBLIC_comments_CommentSUPABASE_URL || "https://placeholder-url.supabase.co";
const commentsKey = 
  process.env.NEXT_PUBLIC_comments_CommentSUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_comments_CommentSUPABASE_PUBLISHABLE_KEY ||
  process.env.comments_SUPABASE_ANON_KEY ||
  process.env.comments_SUPABASE_PUBLISHABLE_KEY ||
  "placeholder-key";

if (!process.env.NEXT_PUBLIC_comments_CommentSUPABASE_URL) {
  console.warn("Comments Supabase URL missing. Review operations will fail.");
}

// Export for reviews/comments operations
export const supabaseComments = createClient(commentsUrl, commentsKey);
