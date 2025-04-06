
import { X } from "lucide-react";

const SocialLinks = () => {
  return (
    <a 
      href="https://twitter.com/f1datastop" 
      target="_blank" 
      rel="noopener noreferrer"
      className="text-gray-400 hover:text-white transition-colors"
      aria-label="Follow us on X/Twitter"
    >
      <X size={20} />
    </a>
  );
};

export default SocialLinks;
