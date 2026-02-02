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
  const [isUpdating, setIsUpdating] = useState(false);
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

  const updateReview = useCallback(async (reviewId: string, rating: number, comment: string) => {
    if (!address) throw new Error("No wallet connected");

    setIsUpdating(true);
    try {
      const response = await fetch("/api/reviews", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewId,
          reviewerAddress: address,
          rating,
          comment,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update review");
      }

      // Update local state
      setReviews((prev) =>
        prev.map((r) => (r.id === reviewId ? { ...r, rating, comment, updated_at: new Date().toISOString() } : r))
      );

      return data.review;
    } catch (err: any) {
      console.error("[useUserReviews] Update error:", err);
      throw err;
    } finally {
      setIsUpdating(false);
    }
  }, [address]);

  const deleteReview = useCallback(async (reviewId: string) => {
    if (!address) throw new Error("No wallet connected");

    setIsUpdating(true);
    try {
      const response = await fetch(
        `/api/reviews?reviewId=${encodeURIComponent(reviewId)}&reviewerAddress=${encodeURIComponent(address)}`,
        { method: "DELETE" }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete review");
      }

      // Remove from local state
      setReviews((prev) => prev.filter((r) => r.id !== reviewId));

      return true;
    } catch (err: any) {
      console.error("[useUserReviews] Delete error:", err);
      throw err;
    } finally {
      setIsUpdating(false);
    }
  }, [address]);

  useEffect(() => {
    fetchUserReviews();
  }, [fetchUserReviews]);

  return {
    reviews,
    reviewCount: reviews.length,
    isLoading,
    isUpdating,
    error,
    refetch: fetchUserReviews,
    updateReview,
    deleteReview,
  };
}
