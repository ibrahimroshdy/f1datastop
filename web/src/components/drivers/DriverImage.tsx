import { useState, useEffect } from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { getCachedImage, getDriverImageUrls } from "@/utils/imageCache";
import { cn } from "@/lib/utils";

interface DriverImageProps {
  driverId: string;
  driverName: string;
  headshotUrl?: string;
  season: number;
  teamColor: string;
  fallbackCode?: string;
  fallbackFamilyName: string;
  className?: string;
}

const DriverImage = ({
  driverId,
  driverName,
  headshotUrl,
  season,
  teamColor,
  fallbackCode,
  fallbackFamilyName,
  className,
}: DriverImageProps) => {
  const [cachedImageUrl, setCachedImageUrl] = useState("");
  const [imageLoading, setImageLoading] = useState(true);

  useEffect(() => {
    const loadDriverImage = async () => {
      try {
        setImageLoading(true);
        const imageUrls = getDriverImageUrls(driverId, headshotUrl, season);
        if (imageUrls.primary) {
          const cached = await getCachedImage(imageUrls.primary, imageUrls.fallback);
          setCachedImageUrl(cached);
        } else {
          setCachedImageUrl("");
        }
      } catch (error) {
        console.warn(`Failed to load image for driver ${driverId}:`, error);
        setCachedImageUrl("");
      } finally {
        setImageLoading(false);
      }
    };

    loadDriverImage();
  }, [driverId, headshotUrl, season]);

  const fallbackLabel = imageLoading
    ? "..."
    : fallbackCode?.slice(0, 2) || fallbackFamilyName.slice(0, 2);

  return (
    <Avatar
      className={cn(
        "h-10 w-10 rounded-full flex items-center justify-center text-white font-bold",
        className,
      )}
      style={{ backgroundColor: teamColor }}
    >
      {cachedImageUrl && (
        <AvatarImage src={cachedImageUrl} alt={driverName} />
      )}
      <AvatarFallback style={{ backgroundColor: teamColor }}>
        {fallbackLabel}
      </AvatarFallback>
    </Avatar>
  );
};

export default DriverImage;
