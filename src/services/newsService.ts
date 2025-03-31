
import { toast } from "sonner";

// Using a news API proxy to avoid CORS issues
const NEWS_API_URL = "https://newsapi.org/v2/everything";
const NEWS_API_KEY = import.meta.env.VITE_NEWS_API_KEY || "fallback_demo_key";

export const getF1News = async () => {
  try {
    const response = await fetch(`${NEWS_API_URL}?q=formula1+OR+f1&language=en&sortBy=publishedAt&apiKey=${NEWS_API_KEY}`);
    
    if (!response.ok) {
      if (response.status === 401) {
        console.warn("News API key missing or invalid - using fallback data");
        return { data: getFallbackNews(), error: null };
      }
      throw new Error(`News API request failed with status ${response.status}`);
    }
    
    const data = await response.json();
    return { data: data.articles, error: null };
  } catch (error) {
    console.error("Failed to fetch F1 news:", error);
    toast.error("Failed to load news. Using cached data instead.");
    return { data: getFallbackNews(), error };
  }
};

// Fallback data with current timestamps
const getFallbackNews = () => {
  const now = new Date();
  
  return [
    {
      title: "Verstappen extends lead with dramatic Monaco victory",
      source: { name: "Formula1.com" },
      publishedAt: new Date(now.getTime() - 10 * 60000).toISOString(),
      url: "#",
      urlToImage: "https://placehold.co/200x120",
    },
    {
      title: "Ferrari's strategy error costs Leclerc potential win at home race",
      source: { name: "Twitter" },
      publishedAt: new Date(now.getTime() - 25 * 60000).toISOString(),
      url: "#",
      urlToImage: null,
    },
    {
      title: "Hamilton: 'The car felt better today but we still have work to do'",
      source: { name: "Mercedes AMG F1" },
      publishedAt: new Date(now.getTime() - 42 * 60000).toISOString(),
      url: "#",
      urlToImage: null,
    },
    {
      title: "Norris secures third consecutive podium, McLaren's development paying off",
      source: { name: "Sky Sports F1" },
      publishedAt: new Date(now.getTime() - 60 * 60000).toISOString(),
      url: "#",
      urlToImage: "https://placehold.co/200x120",
    },
  ];
};
