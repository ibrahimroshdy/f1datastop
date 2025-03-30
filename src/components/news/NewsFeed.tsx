
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const NewsFeed = () => {
  const newsItems = [
    {
      id: 1,
      title: "Verstappen extends lead with dramatic Monaco victory",
      source: "Formula1.com",
      time: "10 minutes ago",
      type: "article",
      image: "https://placehold.co/200x120",
      author: "F1"
    },
    {
      id: 2,
      title: "Ferrari's strategy error costs Leclerc potential win at home race",
      source: "Twitter",
      time: "25 minutes ago",
      type: "tweet",
      author: "F1"
    },
    {
      id: 3,
      title: "Hamilton: 'The car felt better today but we still have work to do'",
      source: "Mercedes AMG F1",
      time: "42 minutes ago",
      type: "quote",
      author: "Mercedes"
    },
    {
      id: 4,
      title: "Norris secures third consecutive podium, McLaren's development paying off",
      source: "Sky Sports F1",
      time: "1 hour ago",
      type: "article",
      image: "https://placehold.co/200x120",
      author: "Sky"
    },
  ];

  const getBadgeColor = (type: string) => {
    switch (type) {
      case "article":
        return "bg-blue-600 hover:bg-blue-700";
      case "tweet":
        return "bg-sky-500 hover:bg-sky-600";
      case "quote":
        return "bg-purple-600 hover:bg-purple-700";
      default:
        return "bg-gray-600 hover:bg-gray-700";
    }
  };

  const getAuthorInitials = (author: string) => {
    return author.substring(0, 2).toUpperCase();
  };

  return (
    <div className="space-y-3">
      {newsItems.map((news) => (
        <Card key={news.id} className="race-card p-4 cursor-pointer hover:border-f1-red/30">
          <div className="flex gap-3">
            {news.image && (
              <div className="hidden sm:block flex-shrink-0 w-[100px] h-[60px] rounded overflow-hidden">
                <img src={news.image} alt={news.title} className="w-full h-full object-cover" />
              </div>
            )}
            <div className="flex-1 space-y-2">
              <div className="flex items-start justify-between">
                <h3 className="font-medium">{news.title}</h3>
                <Badge className={`ml-2 flex-shrink-0 ${getBadgeColor(news.type)}`}>
                  {news.type}
                </Badge>
              </div>
              <div className="flex items-center justify-between text-sm text-gray-400">
                <div className="flex items-center gap-2">
                  <Avatar className="h-5 w-5">
                    <AvatarImage src={`https://placehold.co/25x25/15151e/FFFFFF/png?text=${getAuthorInitials(news.author)}`} />
                    <AvatarFallback>{getAuthorInitials(news.author)}</AvatarFallback>
                  </Avatar>
                  <span>{news.source}</span>
                </div>
                <span>{news.time}</span>
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
};

export default NewsFeed;
