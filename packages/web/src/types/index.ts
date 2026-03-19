export type TabEventSummary = {
  domain: string;
  seconds: number;
  category: string;
};

export type DaySummary = {
  date: string;
  total_active_sec: number;
  domains: TabEventSummary[];
};
