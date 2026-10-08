import type { LeaderboardEntry } from "@/lib/quiz/leaderboard";
import { PlayerName } from "./PlayerName";

export function Leaderboard({
  entries,
  currentUserId,
}: {
  entries: LeaderboardEntry[];
  currentUserId: string;
}) {
  const topTen = entries.slice(0, 10);
  const currentUserEntry = entries.find((e) => e.userId === currentUserId);
  const currentUserInTopTen = topTen.some((e) => e.userId === currentUserId);

  if (entries.length === 0) {
    return (
      <div className="card">
        <h2 className="font-medium">Leaderboard</h2>
        <p className="text-sm text-muted-foreground">
          No results yet — check back once a prize is announced.
        </p>
      </div>
    );
  }

  return (
    <div className="card overflow-x-auto">
      <h2 className="mb-2 font-medium">Leaderboard</h2>
      <table className="w-full text-sm">
        <caption className="sr-only">
          Top ten players by total points, with today&apos;s points
        </caption>
        <thead>
          <tr className="text-left text-muted-foreground">
            <th scope="col" className="w-10">
              #
            </th>
            <th scope="col">Player</th>
            <th scope="col" className="text-right">
              Today
            </th>
            <th scope="col" className="text-right">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {topTen.map((entry) => (
            <tr
              key={entry.userId}
              className={entry.userId === currentUserId ? "font-medium" : ""}
            >
              <td>{entry.rank}</td>
              <th scope="row" className="text-left">
                <PlayerName
                  name={entry.displayName}
                  suffix={entry.userId === currentUserId ? " (you)" : ""}
                />
              </th>
              <td className="text-right">{entry.todayPoints.toFixed(2)}</td>
              <td className="text-right">{entry.totalPoints.toFixed(2)}</td>
            </tr>
          ))}
          {!currentUserInTopTen && currentUserEntry && (
            <>
              <tr>
                <td colSpan={4} className="text-center text-muted-foreground">
                  ...
                </td>
              </tr>
              <tr className="font-medium">
                <td>{currentUserEntry.rank}</td>
                <th scope="row" className="text-left font-medium">
                  <PlayerName
                    name={currentUserEntry.displayName}
                    suffix=" (you)"
                  />
                </th>
                <td className="text-right">
                  {currentUserEntry.todayPoints.toFixed(2)}
                </td>
                <td className="text-right">
                  {currentUserEntry.totalPoints.toFixed(2)}
                </td>
              </tr>
            </>
          )}
        </tbody>
      </table>
    </div>
  );
}
