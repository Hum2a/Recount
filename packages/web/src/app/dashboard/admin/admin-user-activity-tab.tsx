"use client";

import { ActivityExplorer } from "@/components/activity/activity-explorer";
import { adminApi } from "./admin-fetch";

type Props = {
  userId: string;
  canManage: boolean;
  onDataChanged: () => void;
};

export function AdminUserActivityTab({ userId, canManage, onDataChanged }: Props) {
  return (
    <ActivityExplorer
      apiFetch={adminApi}
      buildSummaryPath={(q) => `/api/admin/users/${userId}/tab-events/summary?${q}`}
      buildSegmentsPath={(q) => `/api/admin/users/${userId}/tab-events?${q}`}
      buildDeletePath={(id) => `/api/admin/tab-events/${id}`}
      canDelete={canManage}
      onDataChanged={onDataChanged}
      showMigrationHint
      intro={
        <>
          Raw browser time segments from the extension. Use filters and analytics to spot patterns; delete rows for
          corrections or privacy requests.
        </>
      }
    />
  );
}
