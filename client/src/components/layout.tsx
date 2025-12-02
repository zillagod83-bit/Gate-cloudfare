import React from 'react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Toaster } from "@/components/ui/toaster";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex justify-center items-start sm:items-center sm:p-4 font-sans">
      {/* Mobile Container */}
      <div className="w-full max-w-md bg-background sm:bg-card sm:shadow-xl sm:rounded-[2rem] sm:overflow-hidden h-[100dvh] sm:h-[850px] flex flex-col relative ring-1 ring-black/5">
        <ScrollArea className="flex-1 h-full">
          <div className="flex flex-col min-h-full">
            {children}
          </div>
        </ScrollArea>
        <Toaster />
      </div>
    </div>
  );
}
