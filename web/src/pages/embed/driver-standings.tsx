import { useEffect, useState } from 'react';
import EmbeddableDriverStandings from "../../components/embeddable/EmbeddableDriverStandings";
import { EMBED_FONTS, useEmbedParams } from "../../components/embeddable/useEmbedParams";
import { F1Loader } from "@/components/f1";

const DriverStandingsEmbed = () => {
  // Shared parser (season/theme/font allowlists live in useEmbedParams).
  const params = useEmbedParams();
  const [isReady, setIsReady] = useState(false);

  // Add font styles directly
  useEffect(() => {
    if (!params.font) return;

    // Create a style element for global styles
    const style = document.createElement('style');
    style.textContent = `
      body {
        margin: 0;
        padding: 0;
        overflow-x: hidden;
      }

      /* Force font to apply */
      html, body, * {
        font-family: "${params.font}", system-ui, sans-serif !important;
      }
    `;
    document.head.appendChild(style);

    // Load Google Fonts if needed (font is allowlisted by useEmbedParams,
    // so it is always safe to interpolate into the URL).
    const link = document.createElement('link');
    let appendedLink = false;

    if ((EMBED_FONTS as readonly string[]).includes(params.font)) {
      link.rel = 'stylesheet';
      link.href = `https://fonts.googleapis.com/css2?family=${params.font.replace(/ /g, '+')}:wght@400;500;700&display=swap`;
      document.head.appendChild(link);
      appendedLink = true;

      // Wait for font to load
      document.fonts.ready.then(() => {
        setIsReady(true);
      });
    } else {
      setIsReady(true);
    }

    // Cleanup on unmount
    return () => {
      style.remove();
      if (appendedLink) link.remove();
    };
  }, [params.font]);

  // Add document title
  useEffect(() => {
    document.title = `F1 Driver Standings ${params.season || ''} | Embed`;

    // Add robots meta tag
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex';
    document.head.appendChild(meta);

    return () => {
      meta.remove();
    };
  }, [params.season]);

  // Only render the component when we're ready (prevents flickering).
  // key remounts the widget if the season ever changes (no stale closure).
  if (!isReady) {
    return <F1Loader label="Loading standings…" className="min-h-[200px]" />;
  }

  return (
    <EmbeddableDriverStandings
      key={params.season}
      initialSeason={params.season}
      initialTheme={params.theme}
      initialFont={params.font}
    />
  );
};

export default DriverStandingsEmbed;
