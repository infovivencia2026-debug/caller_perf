/**
 * Auto-assignment spreads unassigned customers equally across telecallers, giving each
 * up to a chosen target. Distribution is round-robin, so everyone ends up within one
 * customer of each other. A caller already holding open customers is topped up toward
 * the target rather than reset, so running it again does not double-load anyone.
 */
export type CallerQueue = {
  id: string;
  name: string;
  /** Open customers already assigned to this caller. */
  queued: number;
};

export type AssignmentPlan = {
  /** callerId -> customer ids to hand them. Callers already at the target are omitted. */
  byCaller: Map<string, string[]>;
  assigned: number;
  /** Customers left over because every caller reached the target. */
  leftOver: number;
};

export function planEqualAssignments(
  callers: CallerQueue[],
  customerIds: string[],
  target: number,
): AssignmentPlan {
  // Remaining room per caller, sorted by name so the result is deterministic.
  const room = callers
    .map((caller) => ({ id: caller.id, name: caller.name, left: Math.max(0, target - caller.queued) }))
    .filter((caller) => caller.left > 0)
    .sort((a, b) => a.name.localeCompare(b.name));

  const byCaller = new Map<string, string[]>();
  let assigned = 0;
  let cursor = 0;

  while (assigned < customerIds.length) {
    const withRoom = room.filter((caller) => caller.left > 0);
    if (withRoom.length === 0) break;

    const caller = withRoom[cursor % withRoom.length];
    cursor += 1;

    const list = byCaller.get(caller.id);
    if (list) list.push(customerIds[assigned]);
    else byCaller.set(caller.id, [customerIds[assigned]]);
    caller.left -= 1;
    assigned += 1;
  }

  return { byCaller, assigned, leftOver: customerIds.length - assigned };
}
