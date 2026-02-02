"use client";

import { useState, useEffect, useCallback } from "react";

export interface UserReview {
  id: string;
  place_id: string;
  reviewer_address: string;
  rating: number;
  comment: string;
  detailed_ratings?: {
    lighting?: number;
    ambiance?: number;
    seating?: number;
    powerOutlets?: number;
    proximityToWater?: number;
    smokingOption?: string;
    category?: string;
  };
  created_at: string;
  updated_at: string;
}

export function useUserReviews(address: string | undefined) {
  const [reviews, setReviews] = useState<UserReview[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUserReviews = useCallback(async () => {
    if (!address) {
      setReviews([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/reviews?reviewerAddress=${encodeURIComponent(address)}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch reviews");
      }

      setReviews(data.reviews || []);
    } catch (err: any) {
      console.error("[useUserReviews] Error:", err);
      setError(err.message);
      setReviews([]);
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  useEffect(() => {
    fetchUserReviews();
  }, [fetchUserReviews]);

  return {
    reviews,
    reviewCount: reviews.length,
    isLoading,
    error,
    refetch: fetchUserReviews,
  };
}
