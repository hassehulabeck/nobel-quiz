import type { LeaderboardEntry } from "@/lib/quiz/leaderboard";

export function FullLeaderboard({
  entries,
  currentUserId,
}: {
  entries: LeaderboardEntry[];
  currentUserId?: string;
}) {
  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No results were recorded this year.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">
          Final ranking for all players by total points
        </caption>
        <thead>
          <tr className="text-left text-muted-foreground">
            <th scope="col" className="w-10">
              #
            </th>
            <th scope="col">Player</th>
            <th scope="col" className="text-right">
              Total points
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr
              key={entry.userId}
              className={entry.userId === currentUserId ? "font-medium" : ""}
            >
              <td>{entry.rank}</td>
              <th scope="row" className="text-left">
                {entry.displayName}
                {entry.userId === currentUserId ? " (you)" : ""}
              </th>
              <td className="text-right">{entry.totalPoints}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
