"use client";

import { useState, useCallback, useRef } from "react";
import { Place } from "../components/DetailPanel";
import { analyzePlacePhotos } from "./ChatGPT_analysis";
import { log } from "../utils/logger";

interface AnalysisState {
  isAnalyzing: boolean;
  error?: string;
  completedAt?: number;
}

export function useAIAnalysis(
  places: Place[],
  setPlaces: (places: Place[]) => void,
  onPlaceUpdate?: (placeId: string, updatedPlace: Place) => void
) {
  // placeId -> AnalysisState
  const [analysisStatus, setAnalysisStatus] = useState<Record<string, AnalysisState>>({});
  
  // Track ongoing analysis promises to avoid duplicate requests
  const ongoingAnalyses = useRef<Record<string, Promise<string[]>>>({});
  
  // Queue of marker clicks to handle rapid succession
  const clickQueue = useRef<string[]>([]);

  const triggerAnalysis = useCallback(async (place: Place) => {
    const placeId = place.id;

    // If already analyzing or already has AI tags, skip
    // Check if place already has AI tags (starting with robot icon or identified as AI tags)
    // In our system, AI tags are added to the existing tags array.
    // We can check if any tag looks like an AI tag or if we've already completed analysis.
    
    if (ongoingAnalyses.current[placeId]) {
      log.analysis("Analysis already in progress for this place", { placeId });
      return;
    }

    // Add to status as analyzing
    setAnalysisStatus(prev => ({
      ...prev,
      [placeId]: { isAnalyzing: true }
    }));

    // Record order of clicks
    clickQueue.current.push(placeId);
    log.analysis("Marker click added to queue", { 
      placeId, 
      queueOrder: clickQueue.current.length 
    });

    const analysisPromise = analyzePlacePhotos(place);
    ongoingAnalyses.current[placeId] = analysisPromise;

    try {
      const newTags = await analysisPromise;
      
      log.analysis("Analysis promise resolved", { 
        placeId, 
        tagsCount: newTags.length 
      });

      if (newTags.length > 0) {
        // Update the specific place in the global list
        // We use a callback to get the most recent places state
        setPlaces(currentPlaces => {
          const updatedPlaces = currentPlaces.map(p => {
            if (p.id === placeId) {
              // Avoid duplicates if tags already exist
              const existingTags = p.tags || [];
              const uniqueNewTags = newTags.filter(tag => !existingTags.includes(tag));
              
              const updatedPlace = {
                ...p,
                tags: [...existingTags, ...uniqueNewTags],
              };

              // Notify update if needed (e.g., for DetailPanel)
              if (onPlaceUpdate) {
                onPlaceUpdate(placeId, updatedPlace);
              }

              return updatedPlace;
            }
            return p;
          });
          return updatedPlaces;
        });
      }

      setAnalysisStatus(prev => ({
        ...prev,
        [placeId]: { isAnalyzing: false, completedAt: Date.now() }
      }));
    } catch (error: any) {
      log.analysisError("Analysis failed in hook", { placeId }, error);
      setAnalysisStatus(prev => ({
        ...prev,
        [placeId]: { isAnalyzing: false, error: error.message }
      }));
    } finally {
      delete ongoingAnalyses.current[placeId];
    }
  }, [setPlaces, onPlaceUpdate]);

  const isPlaceAnalyzing = useCallback((placeId: string) => {
    return analysisStatus[placeId]?.isAnalyzing || false;
  }, [analysisStatus]);

  const getPlaceAnalysisError = useCallback((placeId: string) => {
    return analysisStatus[placeId]?.error;
  }, [analysisStatus]);

  return {
    triggerAnalysis,
    isPlaceAnalyzing,
    getPlaceAnalysisError,
    analysisStatus
  };
}
