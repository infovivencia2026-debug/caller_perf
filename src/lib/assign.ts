/**
 * Auto-assignment spreads unassigned customers across callers up to each caller's
 * daily target. A caller's capacity is their target minus what is already waiting
 * in their queue, so running it twice in a row does not double-load anyone.
 */
export type CallerCapacity = {
  id: string;
  name: string;
  dailyTarget: number;
  queued: number;
};

export type AssignmentPlan = {
  /** callerId -> customer ids to hand them. Callers at capacity are omitted. */
  byCaller: Map<string, string[]>;
  assigned: number;
  /** Customers left over because every caller was already at their target. */
  leftOver: number;
};

export function capacityOf(caller: CallerCapacity) {
  return Math.max(0, caller.dailyTarget - caller.queued);
}

/**
 * Deals customers out one at a time, always to the caller with the most remaining
 * capacity. That fills a 60-target caller faster than a 30-target one without
 * starving anybody, and ties break on name so the result is deterministic.
 */
export function planAssignments(callers: CallerCapacity[], customerIds: string[]): AssignmentPlan {
  const remaining = callers
    .map((caller) => ({ id: caller.id, name: caller.name, left: capacityOf(caller) }))
    .filter((caller) => caller.left > 0);

  const byCaller = new Map<string, string[]>();
  let assigned = 0;

  for (const customerId of customerIds) {
    let best = null as (typeof remaining)[number] | null;
    for (const caller of remaining) {
      if (caller.left <= 0) continue;
      if (!best || caller.left > best.left || (caller.left === best.left && caller.name < best.name)) {
        best = caller;
      }
    }
    if (!best) break;

    const list = byCaller.get(best.id);
    if (list) list.push(customerId);
    else byCaller.set(best.id, [customerId]);
    best.left -= 1;
    assigned += 1;
  }

  return { byCaller, assigned, leftOver: customerIds.length - assigned };
}
