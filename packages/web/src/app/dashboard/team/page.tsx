import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { apiFetch } from "@/lib/api";

type Member = { rank: number; nickname: string; minutes_week: number };

export default async function TeamPage() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) redirect("/login");

  const res = await apiFetch("/api/team/leaderboard", session.access_token);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    return (
      <div className="rounded-xl border border-white/10 bg-card/80 p-6">
        <h1 className="text-xl font-semibold">Team</h1>
        <p className="mt-2 text-sm text-muted">{typeof body.error === "string" ? body.error : "Could not load leaderboard."}</p>
      </div>
    );
  }

  const data = body.data as {
    team_slug: string | null;
    week_start_utc?: string;
    you_opted_in?: boolean;
    members?: Member[];
    message?: string;
  };

  const members = data.members ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Team leaderboard</h1>
        <p className="mt-1 text-sm text-muted">
          Tracked minutes this UTC week (since {data.week_start_utc ?? "—"}). Set your team slug and opt-in under Settings.
        </p>
        {data.message && <p className="mt-2 text-sm text-muted">{data.message}</p>}
      </div>
      {!data.team_slug ? null : (
        <div className="overflow-hidden rounded-xl border border-white/10 bg-card/80 shadow-lg shadow-black/15 ring-1 ring-white/10">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-white/10 bg-white/[0.04] text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">#</th>
                <th className="px-4 py-3 font-medium">Nickname</th>
                <th className="px-4 py-3 font-medium text-right">Minutes (UTC week)</th>
              </tr>
            </thead>
            <tbody>
              {members.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-muted">
                    No opted-in teammates yet.
                  </td>
                </tr>
              ) : (
                members.map((m, i) => (
                  <tr key={`${m.rank}-${i}-${m.nickname}`} className="border-b border-white/5 last:border-0">
                    <td className="px-4 py-3 font-mono text-muted">{m.rank}</td>
                    <td className="px-4 py-3">{m.nickname}</td>
                    <td className="px-4 py-3 text-right font-mono">{m.minutes_week}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
      {data.you_opted_in === false && data.team_slug && (
        <p className="text-sm text-muted">You have a team slug but are not opted in — enable it in Settings to appear here.</p>
      )}
    </div>
  );
}
