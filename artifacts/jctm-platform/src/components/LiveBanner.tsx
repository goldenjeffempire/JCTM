import { useGetLivestreamStatus, getGetLivestreamStatusQueryKey } from "@workspace/api-client-react";
import { Radio } from "lucide-react";

export function LiveBanner() {
  const { data: status } = useGetLivestreamStatus({
    query: { queryKey: getGetLivestreamStatusQueryKey(), refetchInterval: 30000 }
  });

  if (!status?.isLive) return null;

  return (
    <div className="bg-destructive text-destructive-foreground w-full py-2 px-4 flex justify-center items-center gap-3 shadow-md z-[60] relative">
      <div className="flex items-center gap-2 animate-pulse">
        <Radio className="h-4 w-4" />
        <span className="font-bold text-sm tracking-wide">LIVE NOW</span>
      </div>
      <div className="h-4 w-[1px] bg-destructive-foreground/30 hidden sm:block" />
      <span className="text-sm font-medium hidden sm:inline-block truncate max-w-md">
        {status.title || "JCTM Service"}
      </span>
      {status.streamUrl && (
        <a 
          href={status.streamUrl} 
          target="_blank" 
          rel="noopener noreferrer"
          className="ml-2 bg-white text-destructive text-xs font-bold px-3 py-1 rounded-full hover:bg-white/90 transition-colors"
        >
          Watch
        </a>
      )}
    </div>
  );
}
