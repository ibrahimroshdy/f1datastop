import { Share2 } from "lucide-react";
import { toast } from "sonner";

const ShareButton = () => {
  const handleShare = () => {
    try {
      // Use the base URL instead of the current page URL
      const shareUrl = window.location.origin;
      
      navigator.clipboard.writeText(shareUrl);
      toast.success('Link copied to clipboard!');
      
      if (navigator.share && window.isSecureContext) {
        setTimeout(() => {
          try {
            navigator.share({
              title: 'F1 DataStop - Live Formula 1 News and Race Data',
              text: 'Get real-time Formula 1 news, race data, and analysis with F1 DataStop',
              url: shareUrl,
            }).catch(() => {
              console.log('Share API not available or rejected, already used clipboard fallback');
            });
          } catch (shareError) {
            console.log('Error with share API, already used clipboard fallback');
          }
        }, 100);
      }
    } catch (error) {
      console.error('Error sharing:', error);
      toast.error('Could not copy to clipboard. Try manually selecting the URL.');
    }
  };

  return (
    <button 
      onClick={handleShare}
      className="text-muted-foreground hover:text-foreground transition-colors"
      aria-label="Share F1 DataStop"
    >
      <Share2 size={20} />
    </button>
  );
};

export default ShareButton;
