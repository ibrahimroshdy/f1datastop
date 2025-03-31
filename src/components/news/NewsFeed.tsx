
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useF1News } from "@/hooks/useF1Data";
import { formatDistanceToNow } from "date-fns";
import { Loader2 } from "lucide-react";

interface NewsItem {
  title: string;
  url: string;
  urlToImage?: string;
  source: {
    name: string;
  };
  publishedAt: string;
}

const NewsFeed = () => {
  const { data: newsResponse, isLoading, error } = useF1News();
  const newsData = newsResponse?.data as NewsItem[] | undefined;
  
  const getBadgeColor = (source: string) => {
    if (source.toLowerCase().includes("twitter") || source.toLowerCase().includes("x.com")) {
      return "bg-sky-500 hover:bg-sky-600";
    } else if (source.toLowerCase().includes("formula1")) {
      return "bg-f1-red hover:bg-red-700";
    } else if (source.toLowerCase().includes("sky")) {
      return "bg-blue-600 hover:bg-blue-700";
    } else {
      return "bg-gray-600 hover:bg-gray-700";
    }
  };

  const getNewsType = (source: string) => {
    if (source.toLowerCase().includes("twitter") || source.toLowerCase().includes("x.com")) {
      return "tweet";
    } else {
      return "article";
    }
  };

  const getAuthorInitials = (source: string) => {
    const sourceName = source || "Unknown";
    return sourceName.substring(0, 2).toUpperCase();
  };

  const getTimeAgo = (dateString: string) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return "recently";
      }
      return formatDistanceToNow(date, { addSuffix: true });
    } catch (e) {
      return "recently";
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-40">
        <Loader2 className="w-8 h-8 animate-spin text-f1-red" />
      </div>
    );
  }

  if (error || !newsData) {
    return (
      <div className="space-y-3">
        <Card className="race-card p-4">
          <div className="text-center py-4">
            <p className="text-gray-400">Unable to load news. Please try again later.</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {newsData.slice(0, 6).map((news, index) => (
        <Card key={index} className="race-card p-4 cursor-pointer hover:border-f1-red/30">
          <a href={news.url} target="_blank" rel="noopener noreferrer">
            <div className="flex gap-3">
              {news.urlToImage && (
                <div className="hidden sm:block flex-shrink-0 w-[100px] h-[60px] rounded overflow-hidden">
                  <img src={news.urlToImage} alt={news.title} className="w-full h-full object-cover" />
                </div>
              )}
              <div className="flex-1 space-y-2">
                <div className="flex items-start justify-between">
                  <h3 className="font-medium">{news.title}</h3>
                  <Badge className={`ml-2 flex-shrink-0 ${getBadgeColor(news.source.name)}`}>
                    {getNewsType(news.source.name)}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-sm text-gray-400">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-5 w-5">
                      <AvatarImage src={`https://placehold.co/25x25/15151e/FFFFFF/png?text=${getAuthorInitials(news.source.name)}`} />
                      <AvatarFallback>{getAuthorInitials(news.source.name)}</AvatarFallback>
                    </Avatar>
                    <span>{news.source.name}</span>
                  </div>
                  <span>{getTimeAgo(news.publishedAt)}</span>
                </div>
              </div>
            </div>
          </a>
        </Card>
      ))}
    </div>
  );
};

export default NewsFeed;
