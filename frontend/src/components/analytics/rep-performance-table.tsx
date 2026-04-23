"use client";

import { useState, useMemo } from "react";
import { cn, formatNumber, getInitials } from "@/lib/utils";
import type { RepPerformanceData } from "@/types/models";

interface RepPerformanceTableProps {
  data: RepPerformanceData[];
}

type SortKey = keyof Omit<RepPerformanceData, "userId" | "userName">;

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "campaignsCreated", label: "Campaigns" },
  { key: "messagesSent", label: "Sent" },
  { key: "repliesReceived", label: "Replies" },
  { key: "responseRate", label: "Rate" },
  { key: "companiesAdded", label: "Companies" },
  { key: "contactsAdded", label: "Contacts" },
];

export function RepPerformanceTable({ data }: RepPerformanceTableProps) {
  const [sortBy, setSortBy] = useState<SortKey>("responseRate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const sorted = useMemo(() => {
    return [...data].sort((a, b) => {
      const aVal = a[sortBy] as number;
      const bVal = b[sortBy] as number;
      return sortDir === "desc" ? bVal - aVal : aVal - bVal;
    });
  }, [data, sortBy, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortBy === key) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortBy(key);
      setSortDir("desc");
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900">
        Rep Leaderboard
      </h3>
      <p className="mt-0.5 text-sm text-gray-500">
        Performance by team member
      </p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="px-2 py-2.5 text-xs font-semibold uppercase tracking-wider text-gray-500">
                #
              </th>
              <th className="px-2 py-2.5 text-xs font-semibold uppercase tracking-wider text-gray-500">
                Name
              </th>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className="cursor-pointer select-none px-2 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 hover:text-gray-700"
                  onClick={() => handleSort(col.key)}
                >
                  <div className="flex items-center justify-end gap-1">
                    {col.label}
                    {sortBy === col.key && (
                      <span className="text-primary-600">
                        {sortDir === "desc" ? "\u2193" : "\u2191"}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {sorted.length === 0 && (
              <tr>
                <td
                  colSpan={COLUMNS.length + 2}
                  className="px-2 py-8 text-center text-sm text-gray-500"
                >
                  No rep data available.
                </td>
              </tr>
            )}
            {sorted.map((rep, index) => {
              const isTop = index === 0 && sorted.length > 1;
              return (
                <tr
                  key={rep.userId}
                  className={cn(
                    "transition-colors hover:bg-gray-50",
                    isTop && "bg-amber-50/50"
                  )}
                >
                  <td className="px-2 py-3">
                    <span
                      className={cn(
                        "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold",
                        isTop
                          ? "bg-amber-400 text-white"
                          : index === 1
                          ? "bg-gray-300 text-white"
                          : index === 2
                          ? "bg-orange-300 text-white"
                          : "bg-gray-100 text-gray-500"
                      )}
                    >
                      {index + 1}
                    </span>
                  </td>
                  <td className="px-2 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary-700">
                        {getInitials(rep.userName)}
                      </div>
                      <span className="font-medium text-gray-900">
                        {rep.userName}
                      </span>
                    </div>
                  </td>
                  <td className="px-2 py-3 text-right text-gray-700">
                    {formatNumber(rep.campaignsCreated)}
                  </td>
                  <td className="px-2 py-3 text-right text-gray-700">
                    {formatNumber(rep.messagesSent)}
                  </td>
                  <td className="px-2 py-3 text-right text-gray-700">
                    {formatNumber(rep.repliesReceived)}
                  </td>
                  <td className="px-2 py-3 text-right">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2 py-0.5 text-xs font-bold",
                        rep.responseRate >= 20
                          ? "bg-green-50 text-green-700"
                          : "text-gray-700"
                      )}
                    >
                      {(rep.responseRate ?? 0).toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-2 py-3 text-right text-gray-700">
                    {formatNumber(rep.companiesAdded)}
                  </td>
                  <td className="px-2 py-3 text-right text-gray-700">
                    {formatNumber(rep.contactsAdded)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
