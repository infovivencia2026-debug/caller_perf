/**
 * Auto-assignment distributes unassigned customers to counsellors up to a chosen target
 * each, split EQUALLY (round-robin) and independent of any metric — recent call volume no
 * longer influences who gets what. A caller already holding open customers is only topped
 * up toward the target rather than reset, so everyone ends level at the same target.
 */
export type CallerQueue = {
  id: string;
  name: string;
  /** Open customers already assigned to this caller. */
  queued: number;
  /** Recent call count — kept in the type for callers that still pass it, but no longer
   *  used for balancing (assignment is equal regardless of metrics). */
  recentCalls?: number;
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
      // Everyone starts level; the only thing that grows the load is getting a customer,
      // so the pool is shared out equally (round-robin) rather than by recent calls.
      load: 0,
    }))
    .filter((caller) => caller.left > 0);

  const byCaller = new Map<string, string[]>();
  let assigned = 0;

  for (const customerId of customerIds) {
    // Whoever has received the fewest so far and still has room; ties break on name.
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
