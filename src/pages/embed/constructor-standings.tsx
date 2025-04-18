import React, { useEffect, useState } from "react";
import EmbeddableConstructorStandings from "../../components/embeddable/EmbeddableConstructorStandings";

const ConstructorStandingsEmbed = () => {
  // Get URL parameters
  const [params, setParams] = useState<{
    season?: number;
    theme?: "light" | "dark";
    font?: string;
  }>({});
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Parse URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const season = urlParams.get('season');
    const theme = urlParams.get('theme');
    const font = urlParams.get('font');
    
    setParams({
      season: season && !isNaN(Number(season)) ? Number(season) : new Date().getFullYear(),
      theme: theme === "dark" ? "dark" : "light",
      font: font || "Inter"
    });
  }, []);
  
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
    
    // Load Google Fonts if needed
    const fontToLoad = params.font.replace(/['"]/g, '').trim();
    
    if (["Roboto", "Open Sans", "Montserrat", "Inter"].includes(fontToLoad)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = `https://fonts.googleapis.com/css2?family=${fontToLoad.replace(/ /g, '+')}:wght@400;500;700&display=swap`;
      document.head.appendChild(link);
      
      // Wait for font to load
      document.fonts.ready.then(() => {
        setIsReady(true);
      });
    } else {
      setIsReady(true);
    }
    
    // Cleanup on unmount
    return () => {
      document.head.removeChild(style);
    };
  }, [params.font]);

  // Add document title
  useEffect(() => {
    document.title = `F1 Constructor Standings ${params.season || ''} | Embed`;
    
    // Add robots meta tag
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex';
    document.head.appendChild(meta);
    
    return () => {
      document.head.removeChild(meta);
    };
  }, [params.season]);

  // Only render the component when we're ready (prevents flickering)
  if (!params.season) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <EmbeddableConstructorStandings 
      initialSeason={params.season}
      initialTheme={params.theme}
      initialFont={params.font}
    />
  );
};

export default ConstructorStandingsEmbed; 