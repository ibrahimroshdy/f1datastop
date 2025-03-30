
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Send } from "lucide-react";
import { useState } from "react";

interface ChatMessage {
  id: number;
  user: string;
  avatar: string;
  message: string;
  time: string;
}

const LiveChat = () => {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 1,
      user: "F1Fan44",
      avatar: "H",
      message: "Hamilton's pace on those mediums is looking strong!",
      time: "1 min ago"
    },
    {
      id: 2,
      user: "MaxAttack",
      avatar: "M",
      message: "Verstappen building a gap now, Ferrari needs to respond",
      time: "3 mins ago"
    },
    {
      id: 3,
      user: "LeclercSupporter",
      avatar: "L",
      message: "Charles needs to pit soon, those tires are finished",
      time: "4 mins ago"
    },
    {
      id: 4,
      user: "RacingExpert",
      avatar: "R",
      message: "Track position is everything at Monaco, hard to pass here",
      time: "6 mins ago"
    },
  ]);

  const handleSendMessage = () => {
    if (input.trim()) {
      const newMessage = {
        id: messages.length + 1,
        user: "You",
        avatar: "Y",
        message: input,
        time: "Just now"
      };
      setMessages([newMessage, ...messages]);
      setInput("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSendMessage();
    }
  };

  return (
    <Card className="race-card h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Live Chat</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden flex flex-col">
        <div className="flex items-center gap-2 pb-3">
          <Input 
            placeholder="Type a message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="bg-f1-black border-gray-800 focus:border-f1-red"
          />
          <Button 
            size="icon" 
            className="bg-f1-red hover:bg-red-700" 
            onClick={handleSendMessage}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="overflow-y-auto flex-1 space-y-3 pr-1">
          {messages.map((msg) => (
            <div key={msg.id} className="flex gap-3">
              <Avatar className="h-8 w-8 flex-shrink-0">
                <AvatarImage src={`https://placehold.co/32x32/15151e/FFFFFF/png?text=${msg.avatar}`} />
                <AvatarFallback>{msg.avatar}</AvatarFallback>
              </Avatar>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{msg.user}</span>
                  <span className="text-xs text-gray-400">{msg.time}</span>
                </div>
                <p className="text-sm">{msg.message}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default LiveChat;
