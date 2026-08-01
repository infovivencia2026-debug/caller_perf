/**
 * Auto-assignment distributes unassigned customers to telecallers up to a chosen
 * target each, but balanced by how many calls they have made recently: each customer
 * goes to whoever has the lowest projected call load. So a caller who has been calling
 * a lot gets fewer new customers, and over time everyone's call volume evens out — the
 * "more calls today, fewer tomorrow" rule. A caller already holding open customers is
 * topped up toward the target rather than reset.
 */
export type CallerQueue = {
  id: string;
  name: string;
  /** Open customers already assigned to this caller. */
  queued: number;
  /** Calls made in the recent balancing window — the starting "load". */
  recentCalls: number;
};

export type AssignmentPlan = {
  byCaller: Map<string, string[]>;
  assigned: number;
  /** Customers left over because every caller reached the target. */
  leftOver: number;
};

export function planBalancedAssignments(
  callers: CallerQueue[],
  customerIds: string[],
  target: number,
): AssignmentPlan {
  const state = callers
    .map((caller) => ({
      id: caller.id,
      name: caller.name,
      left: Math.max(0, target - caller.queued),
      load: caller.recentCalls,
    }))
    .filter((caller) => caller.left > 0);

  const byCaller = new Map<string, string[]>();
  let assigned = 0;

  for (const customerId of customerIds) {
    // Whoever has the smallest projected load and still has room; ties break on name.
    let best: (typeof state)[number] | null = null;
    for (const caller of state) {
      if (caller.left <= 0) continue;
      if (!best || caller.load < best.load || (caller.load === best.load && caller.name < best.name)) {
        best = caller;
      }
    }
    if (!best) break;

    const list = byCaller.get(best.id);
    if (list) list.push(customerId);
    else byCaller.set(best.id, [customerId]);
    best.left -= 1;
    best.load += 1;
    assigned += 1;
  }

  return { byCaller, assigned, leftOver: customerIds.length - assigned };
}
