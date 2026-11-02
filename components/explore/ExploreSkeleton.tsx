import React from "react";

export const ExploreSkeleton = () => {
  return (
    <div className="min-h-screen bg-black/40 backdrop-blur-md animate-in fade-in duration-500">
      <div className="max-w-[1600px] mx-auto px-4 md:px-6 pt-32 pb-6 space-y-6">
        {/* Stats Widgets Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 glass-card rounded-2xl p-5 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-shimmer" />
              <div className="flex justify-between items-start">
                <div className="space-y-3 flex-1">
                  <div className="h-4 w-24 bg-white/10 rounded" />
                  <div className="h-8 w-32 bg-white/20 rounded" />
                </div>
                <div className="h-12 w-24 bg-white/10 rounded-lg" />
              </div>
            </div>
          ))}
        </div>

        {/* Summary Cards Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-64 glass-card rounded-2xl p-5 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-shimmer" />
              <div className="h-5 w-32 bg-white/15 rounded mb-6" />
              <div className="space-y-4">
                {[1, 2, 3, 4].map((j) => (
                  <div key={j} className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-white/10" />
                      <div className="h-4 w-20 bg-white/10 rounded" />
                    </div>
                    <div className="h-4 w-12 bg-white/10 rounded" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Explorer Section Skeleton */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex gap-2">
              <div className="h-10 w-24 bg-white/10 rounded-lg" />
              <div className="h-10 w-24 bg-white/10 rounded-lg" />
              <div className="h-10 w-24 bg-white/10 rounded-lg" />
            </div>
            <div className="h-10 w-64 bg-white/10 rounded-full" />
          </div>

          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-8 w-32 bg-white/5 rounded-full shrink-0" />
            ))}
          </div>

          {/* Table Skeleton */}
          <div className="glass-card rounded-2xl overflow-hidden border border-white/10 bg-white/5">
            <div className="p-4 border-b border-white/10">
              <div className="flex justify-between">
                <div className="h-4 w-8 bg-white/10 rounded" />
                <div className="h-4 w-48 bg-white/10 rounded" />
                <div className="h-4 w-24 bg-white/10 rounded" />
                <div className="h-4 w-24 bg-white/10 rounded" />
                <div className="h-4 w-24 bg-white/10 rounded" />
              </div>
            </div>
            <div className="divide-y divide-white/5">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div key={i} className="p-4 flex justify-between items-center relative overflow-hidden">
                   <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-shimmer" />
                  <div className="h-6 w-6 bg-white/10 rounded" />
                  <div className="flex items-center gap-3 flex-1 ml-4">
                    <div className="w-8 h-8 rounded-full bg-white/10" />
                    <div className="space-y-1">
                      <div className="h-4 w-24 bg-white/15 rounded" />
                      <div className="h-3 w-12 bg-white/10 rounded" />
                    </div>
                  </div>
                  <div className="h-4 w-20 bg-white/15 rounded" />
                  <div className="h-4 w-16 bg-white/20 rounded ml-12" />
                  <div className="h-4 w-24 bg-white/15 rounded ml-12" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
