"use client";

import { useAccount } from "wagmi";
import { useState, useEffect, useCallback } from "react";

export interface Review {
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

// Keep BlockchainReview for backwards compatibility in DetailPanel
export interface BlockchainReview {
  tokenId: bigint;
  placeId: string;
  rating: number;
  comment: string;
  photos: string[];
  reviewer: `0x${string}`;
  createdAt: bigint;
}

export function useReviews(placeId: string | null) {
  const { address, isConnected } = useAccount();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoadingReviews, setIsLoadingReviews] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [submitError, setSubmitError] = useState<Error | null>(null);

  // Fetch reviews from Supabase
  const fetchReviews = useCallback(async () => {
    if (!placeId) {
      setReviews([]);
      return;
    }

    setIsLoadingReviews(true);
    try {
      const response = await fetch(`/api/reviews?placeId=${encodeURIComponent(placeId)}`);
      
      const data = await response.json();
      
      if (!response.ok) {
        console.error("[useReviews] Server error details:", data);
        throw new Error(`Failed to fetch reviews: ${JSON.stringify(data)}`);
      }

      setReviews(data.reviews || []);
    } catch (error) {
      console.error("[useReviews] Failed to fetch reviews:", error);
      setReviews([]);
    } finally {
      setIsLoadingReviews(false);
    }
  }, [placeId]);

  // Load reviews when placeId changes
  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  // Submit a new review
  const submitReview = async (
    rating: number, 
    comment: string, 
    _photos: string[] = [], // photos parameter kept for backwards compatibility but not used
    detailedRatings?: {
      lighting?: number;
      ambiance?: number;
      seating?: number;
      powerOutlets?: number;
      proximityToWater?: number;
      smokingOption?: string;
      category?: string;
    }
  ) => {
    if (!placeId || !isConnected || !address) {
      throw new Error("Wallet connection required to submit review");
    }

    if (rating < 1 || rating > 5) {
      throw new Error("Rating must be between 1 and 5");
    }

    if (!comment.trim()) {
      throw new Error("Comment cannot be empty");
    }

    setIsSubmitting(true);
    setSubmitError(null);
    setIsConfirmed(false);

    try {
      console.log("[useReviews] Submitting review:", { placeId, rating, comment: comment.substring(0, 50) });
      
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          placeId,
          reviewerAddress: address,
          rating,
          comment: comment.trim(),
          detailedRatings,
        }),
      });

      console.log("[useReviews] Response status:", response.status);
      
      const responseData = await response.json();
      console.log("[useReviews] Response data:", JSON.stringify(responseData, null, 2));

      if (!response.ok) {
        throw new Error(responseData.error || "Failed to submit review");
      }

      console.log("[useReviews] Review submitted successfully!");
      setIsConfirmed(true);
      
      // Refresh reviews after successful submission
      await fetchReviews();
      
      // Reset confirmed state after 3 seconds
      setTimeout(() => setIsConfirmed(false), 3000);
    } catch (error: any) {
      console.error("[useReviews] Submit error:", error);
      setSubmitError(error);
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  // Convert to BlockchainReview format for backwards compatibility with DetailPanel
  const blockchainReviews: BlockchainReview[] = reviews.map((review, index) => ({
    tokenId: BigInt(index),
    placeId: review.place_id,
    rating: review.rating,
    comment: review.comment,
    photos: [],
    reviewer: review.reviewer_address as `0x${string}`,
    createdAt: BigInt(Math.floor(new Date(review.created_at).getTime() / 1000)),
  }));

  return {
    reviews: blockchainReviews,
    rawReviews: reviews, // Original Supabase format
    submitReview,
    isSubmitting,
    isConfirmed,
    submitError,
    isConnected,
    address,
    isLoadingReviews,
    refetch: fetchReviews,
  };
}
