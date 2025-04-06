
import { Twitter, MessageCircle } from "lucide-react";

const SocialLinks = () => {
  return (
    <div className="flex items-center gap-3">
      <a 
        href="https://twitter.com/f1datastop" 
        target="_blank" 
        rel="noopener noreferrer"
        className="text-gray-400 hover:text-white transition-colors"
        aria-label="Follow us on X/Twitter"
      >
        <Twitter size={20} />
      </a>
      <a 
        href="https://www.reddit.com/user/f1datastop/"
        target="_blank" 
        rel="noopener noreferrer"
        className="text-gray-400 hover:text-white transition-colors"
        aria-label="Follow us on Reddit"
      >
        <MessageCircle size={20} />
      </a>
    </div>
  );
};

export default SocialLinks;
