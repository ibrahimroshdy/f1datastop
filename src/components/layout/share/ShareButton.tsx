
import { Share2 } from "lucide-react";
import { toast } from "sonner";

const ShareButton = () => {
  const handleShare = () => {
    try {
      navigator.clipboard.writeText(window.location.href);
      toast.success('Link copied to clipboard!');
      
      if (navigator.share && window.isSecureContext) {
        setTimeout(() => {
          try {
            navigator.share({
              title: 'F1 DataStop - Live Formula 1 News and Race Data',
              text: 'Get real-time Formula 1 news, race data, and analysis with F1 DataStop',
              url: window.location.href,
            }).catch(err => {
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
      className="text-gray-400 hover:text-white transition-colors"
      aria-label="Share F1 DataStop"
    >
      <Share2 size={20} />
    </button>
  );
};

export default ShareButton;
