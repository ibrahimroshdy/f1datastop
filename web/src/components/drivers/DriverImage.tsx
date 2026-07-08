import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { getDriverImageUrls } from "@/utils/imageCache";
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
  // Use the headshot URL directly as the <img> src. A JS fetch (getCachedImage)
  // fails on the F1 media CDN's CORS policy → the whole list fell back to
  // initials. A native <img> load is not CORS-restricted for display, so the
  // headshot renders (and AvatarImage auto-shows the fallback on a load error).
  const imageUrls = getDriverImageUrls(driverId, headshotUrl, season);
  const cachedImageUrl = imageUrls.primary ?? "";

  const fallbackLabel =
    fallbackCode?.slice(0, 2) || fallbackFamilyName.slice(0, 2);

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
