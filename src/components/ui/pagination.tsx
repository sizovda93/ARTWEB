"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
}

export function Pagination({ currentPage, totalPages }: PaginationProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (totalPages <= 1) return null;

  function goToPage(page: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (page > 1) params.set("page", page.toString());
    else params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  const pages: number[] = [];
  const start = Math.max(1, currentPage - 2);
  const end = Math.min(totalPages, currentPage + 2);
  for (let i = start; i <= end; i++) pages.push(i);

  return (
    <div className="flex items-center justify-between mt-4">
      <p className="text-sm text-gray-500">
        Страница {currentPage} из {totalPages}
      </p>
      <div className="flex gap-1">
        <button
          onClick={() => goToPage(currentPage - 1)}
          disabled={currentPage <= 1}
          className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          &larr;
        </button>
        {pages.map((p) => (
          <button
            key={p}
            onClick={() => goToPage(p)}
            className={`px-3 py-1.5 text-sm rounded-lg ${
              p === currentPage
                ? "bg-indigo-50 text-indigo-700 font-medium"
                : "hover:bg-gray-50 text-gray-600"
            }`}
          >
            {p}
          </button>
        ))}
        <button
          onClick={() => goToPage(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          &rarr;
        </button>
      </div>
    </div>
  );
}
