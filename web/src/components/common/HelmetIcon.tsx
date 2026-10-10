import { Icon, type LucideProps } from "lucide-react";
import { motorRacingHelmet } from "@lucide/lab";

/** Racing-helmet icon (lucide-lab) — used for driver contexts instead of a generic
 *  person/silhouette. Same stroke style as the rest of our lucide icons. */
export function HelmetIcon(props: LucideProps) {
  return <Icon iconNode={motorRacingHelmet} {...props} />;
}

export default HelmetIcon;
