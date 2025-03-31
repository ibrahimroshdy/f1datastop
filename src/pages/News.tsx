
import { useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import { useF1News } from "@/hooks/useF1Data";
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO } from "date-fns";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";

const News = () => {
  const { data: newsData, isLoading } = useF1News();

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col">
          <h1 className="text-3xl font-bold">F1 News</h1>
          <p className="text-muted-foreground">Latest news and updates from the world of Formula 1</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoading ? (
            Array(6).fill(0).map((_, i) => (
              <Card key={i}>
                <Skeleton className="h-48 w-full rounded-t-lg" />
                <CardHeader>
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-6 w-full" />
                  <Skeleton className="h-4 w-4/5" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full mt-2" />
                  <Skeleton className="h-4 w-4/5 mt-2" />
                </CardContent>
                <CardFooter>
                  <Skeleton className="h-10 w-full" />
                </CardFooter>
              </Card>
            ))
          ) : (
            newsData?.data.map((article: any, index: number) => (
              <Card key={index} className="overflow-hidden flex flex-col">
                <div className="h-48 overflow-hidden">
                  <img 
                    src={article.urlToImage || "https://placehold.co/600x400?text=F1+News"} 
                    alt={article.title} 
                    className="w-full h-full object-cover"
                  />
                </div>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <Badge variant="outline" className="bg-f1-dark">
                      {article.source.name}
                    </Badge>
                    {article.publishedAt && (
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(article.publishedAt), 'dd MMM yyyy')}
                      </span>
                    )}
                  </div>
                  <CardTitle className="line-clamp-2">{article.title}</CardTitle>
                </CardHeader>
                <CardContent className="flex-grow">
                  <p className="text-muted-foreground line-clamp-3">
                    {article.description || "Click to read the full article on the source website."}
                  </p>
                </CardContent>
                <CardFooter>
                  <Button 
                    className="w-full" 
                    variant="outline"
                    onClick={() => window.open(article.url, "_blank")}
                  >
                    Read More <ExternalLink className="ml-2 h-4 w-4" />
                  </Button>
                </CardFooter>
              </Card>
            ))
          )}
        </div>
      </div>
    </MainLayout>
  );
};

export default News;
