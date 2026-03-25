"use client";

import { ActivityExplorer } from "@/components/activity/activity-explorer";
import { userApi } from "@/lib/user-api-fetch";

type Props = {
  licensed: boolean;
};

export function MyActivityClient({ licensed }: Props) {
  return (
    <ActivityExplorer
      apiFetch={userApi}
      buildSummaryPath={(q) => `/api/events/me/activity/summary?${q}`}
      buildSegmentsPath={(q) => `/api/events/me/activity/segments?${q}`}
      buildDeletePath={(id) => `/api/events/me/activity/segments/${id}`}
      canDelete
      freeTierLimited={!licensed}
      intro={
        <>
          Explore your own tracking data: totals, top sites, filters, and every segment the extension recorded (for the
          date range you&apos;re allowed to see).
        </>
      }
    />
  );
}
