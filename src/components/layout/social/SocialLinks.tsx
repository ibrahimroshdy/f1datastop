import { Twitter } from "lucide-react";

const SocialLinks = () => {
  return (
    <div className="flex items-center gap-3">
      <a 
        href="https://twitter.com/f1datastop" 
        target="_blank" 
        rel="noopener noreferrer"
        className="text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Follow us on X/Twitter"
      >
        <Twitter size={20} />
      </a>
    </div>
  );
};

export default SocialLinks;
