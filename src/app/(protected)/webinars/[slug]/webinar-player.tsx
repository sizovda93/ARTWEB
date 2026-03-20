"use client";

import { useEffect, useRef } from "react";
import { apiClient } from "@/lib/api-client";

export function WebinarPlayer({
  webinarId,
  url,
  isLive,
}: {
  webinarId: string;
  url: string;
  isLive: boolean;
}) {
  const attended = useRef(false);

  useEffect(() => {
    if (attended.current) return;
    attended.current = true;

    // Record attendance on mount
    apiClient(`/api/webinars/${webinarId}/attend`, { method: "POST" });

    // Record leave on unmount
    return () => {
      apiClient(`/api/webinars/${webinarId}/attend`, { method: "DELETE" });
    };
  }, [webinarId]);

  const isEmbed = url.includes("youtube") || url.includes("vimeo") || url.includes("rutube") || url.includes("embed");

  return (
    <div className="bg-black rounded-xl overflow-hidden">
      {isLive && (
        <div className="bg-red-600 text-white text-xs font-medium px-3 py-1 text-center">
          LIVE
        </div>
      )}
      {isEmbed ? (
        <iframe
          src={url}
          className="w-full aspect-video"
          allowFullScreen
          allow="autoplay; fullscreen; picture-in-picture"
        />
      ) : (
        <video src={url} controls className="w-full aspect-video" />
      )}
    </div>
  );
}
