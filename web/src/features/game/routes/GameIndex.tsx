import { useAuth } from "@/context/AuthContext";
import { F1Skeleton } from "@/components/f1";
import GameHub from "./GameHub";
import LeagueLanding from "./LeagueLanding";

/**
 * `/game` entry point. Members land in the Paddock (GameHub); guests get the
 * public League landing instead of a login wall — so the game is discoverable
 * without an account. The deeper `/game/*` routes stay auth-gated.
 */
export default function GameIndex() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <F1Skeleton variant="circular" className="h-12 w-12" />
      </div>
    );
  }

  return user ? <GameHub /> : <LeagueLanding />;
}
