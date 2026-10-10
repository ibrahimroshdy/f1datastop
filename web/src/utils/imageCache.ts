// Image caching utility for driver images and other static assets
import { withCache } from './cache';
import {
  buildF1DriverHeadshotUrl,
  getF1PortraitPathForErgastDriverId,
  F1_DRIVER_PORTRAIT_SEASON,
} from '@/constants/f1DriverPortraitMedia';

// Cache TTL for images (7 days - images rarely change)
const IMAGE_CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

// Memory cache for immediate access
const imageMemoryCache = new Map<string, string>();

/**
 * Fetch and cache an image URL
 * @param imageUrl - The URL of the image to cache
 * @param fallbackUrl - Optional fallback URL if primary fails
 * @returns Promise<string> - Returns cached or fetched image URL
 */
export const getCachedImage = async (
  imageUrl: string, 
  fallbackUrl?: string
): Promise<string> => {
  // Check memory cache first for immediate access
  if (imageMemoryCache.has(imageUrl)) {
    return imageMemoryCache.get(imageUrl)!;
  }

  try {
    const cacheKey = `image:${imageUrl}`;
    
    const cachedImageData = await withCache(
      cacheKey,
      IMAGE_CACHE_TTL,
      async () => {
        // Try to fetch the primary image
        let response: Response;
        try {
          response = await fetch(imageUrl, {
            mode: 'cors',
            cache: 'force-cache'
          });
          
          if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.status}`);
          }
        } catch (error) {
          // If primary fails and we have a fallback, try that
          if (fallbackUrl) {
            console.log(`Primary image failed for ${imageUrl}, trying fallback: ${fallbackUrl}`);
            response = await fetch(fallbackUrl, {
              mode: 'cors',
              cache: 'force-cache'
            });
            
            if (!response.ok) {
              throw new Error(`Fallback image also failed: ${response.status}`);
            }
          } else {
            throw error;
          }
        }

        // Convert to blob and then to base64 data URL for caching
        const blob = await response.blob();
        return new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      },
      { 
        namespace: 'images',
        staleWhileRevalidate: true
      }
    );

    // Store in memory cache for quick access
    imageMemoryCache.set(imageUrl, cachedImageData);
    return cachedImageData;

  } catch (error) {
    console.warn(`Failed to cache image ${imageUrl}:`, error);
    
    // If caching fails, try fallback or return original URL
    if (fallbackUrl && fallbackUrl !== imageUrl) {
      try {
        return await getCachedImage(fallbackUrl);
      } catch (fallbackError) {
        console.warn(`Fallback image also failed:`, fallbackError);
        return imageUrl; // Return original URL as last resort
      }
    }
    
    return imageUrl; // Return original URL as fallback
  }
};

/**
 * Preload and cache multiple images
 * @param imageUrls - Array of image URLs to preload
 */
export const preloadImages = async (imageUrls: string[]): Promise<void> => {
  const promises = imageUrls.map(url => 
    getCachedImage(url).catch(error => {
      console.warn(`Failed to preload image ${url}:`, error);
      return url; // Continue with other images even if one fails
    })
  );
  
  await Promise.allSettled(promises);
};

/**
 * Clear image cache
 */
export const clearImageCache = (): void => {
  imageMemoryCache.clear();
  // Clear from persistent storage via cache utility
  if (typeof window !== 'undefined' && window.localStorage) {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith('f1cache:images:')) {
        localStorage.removeItem(key);
      }
    });
  }
};

/**
 * Get driver avatar image URLs.
 * Primary: official F1 media (Cloudinary) for the configured portrait season when mapped.
 * Fallback: OpenF1 `headshot_url` when F1 URL is missing or fails to load.
 */
export const getDriverImageUrls = (
  driverId: string,
  headshotUrl?: string,
  portraitSeason: number = F1_DRIVER_PORTRAIT_SEASON
) => {
  const f1Path = getF1PortraitPathForErgastDriverId(driverId, portraitSeason);
  if (f1Path) {
    const primary = buildF1DriverHeadshotUrl(f1Path);
    return {
      primary,
      ...(headshotUrl ? { fallback: headshotUrl } : {}),
    } as { primary: string; fallback?: string };
  }

  if (headshotUrl) {
    return { primary: headshotUrl } as { primary: string; fallback?: string };
  }

  return {} as { primary?: string; fallback?: string };
};

/**
 * React hook for cached image loading
 * @param imageUrl - Primary image URL
 * @param fallbackUrl - Optional fallback URL
 * @returns Object with cached URL, loading state, and error state
 */
export const useCachedImage = (imageUrl: string, fallbackUrl?: string) => {
  const [cachedUrl, setCachedUrl] = React.useState<string>(imageUrl);
  const [isLoading, setIsLoading] = React.useState(true);
  const [hasError, setHasError] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;
    
    const loadImage = async () => {
      if (!imageUrl) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setHasError(false);
        
        const cached = await getCachedImage(imageUrl, fallbackUrl);
        
        if (mounted) {
          setCachedUrl(cached);
          setIsLoading(false);
        }
      } catch (error) {
        if (mounted) {
          setHasError(true);
          setIsLoading(false);
          setCachedUrl(fallbackUrl || imageUrl);
        }
      }
    };

    loadImage();

    return () => {
      mounted = false;
    };
  }, [imageUrl, fallbackUrl]);

  return { cachedUrl, isLoading, hasError };
};

// Add React import for the hook
import React from 'react';