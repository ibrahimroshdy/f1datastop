
import { useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle } from "lucide-react";
import { useApi } from "@/context/ApiContext";

export function BackendStatusIndicator() {
  const { isBackendConnected } = useApi();
  
  if (isBackendConnected) {
    return (
      <Badge variant="outline" className="bg-green-600 text-white border-0">
        <CheckCircle2 className="w-3 h-3 mr-1" />
        Python Backend Connected
      </Badge>
    );
  } else {
    return (
      <Badge variant="outline" className="bg-red-600 text-white border-0">
        <XCircle className="w-3 h-3 mr-1" />
        Backend Disconnected
      </Badge>
    );
  }
}

export default BackendStatusIndicator;
