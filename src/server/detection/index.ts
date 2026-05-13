import { and, eq } from 'drizzle-orm'
import { db } from '#/db'
import { discoveryCursors, inboxItems, inventory } from '#/db/schema'
import { discoverInventory, type InventoryDiscoveryKind } from '#/lib/telemetry'

const FIRST_SCAN_MS = 30 * 24 * 60 * 60 * 1000

export async function runDetection(kind: InventoryDiscoveryKind): Promise<{ observed: number; inserted: number }> {
  const now = Date.now()
  const [cursor] = await db.select().from(discoveryCursors).where(eq(discoveryCursors.kind, kind)).limit(1)
  const fromMs = cursor?.lastScannedAt.getTime() ?? now - FIRST_SCAN_MS
  const observations = await discoverInventory(kind, { fromUs: fromMs * 1000, toUs: now * 1000 })

  let inserted = 0
  let maxSeenMs = fromMs

  for (const observation of observations) {
    maxSeenMs = Math.max(maxSeenMs, observation.lastSeenMs)
    const [existing] = await db
      .select({ id: inventory.id })
      .from(inventory)
      .where(
        and(
          eq(inventory.kind, observation.kind),
          eq(inventory.name, observation.name),
          eq(inventory.namespace, observation.namespace),
        ),
      )
      .limit(1)

    if (existing) {
      await db
        .update(inventory)
        .set({ lastSeenAt: new Date(observation.lastSeenMs) })
        .where(eq(inventory.id, existing.id))
      continue
    }

    await db.insert(inventory).values({
      kind: observation.kind,
      name: observation.name,
      namespace: observation.namespace,
      firstSeenAt: new Date(observation.firstSeenMs),
      firstSeenTraceId: observation.traceId,
      lastSeenAt: new Date(observation.lastSeenMs),
    })
    await db
      .insert(inboxItems)
      .values({
        kind,
        firedAt: new Date(),
        summary: summaryFor(kind, observation.name, observation.namespace),
        payloadJson: observation,
        traceId: observation.traceId,
        dedupeKey: `${kind}:${observation.name}:${observation.namespace}`,
      })
      .onConflictDoNothing()
    inserted += 1
  }

  await db
    .insert(discoveryCursors)
    .values({ kind, lastScannedAt: new Date(maxSeenMs) })
    .onConflictDoUpdate({
      target: discoveryCursors.kind,
      set: { lastScannedAt: new Date(maxSeenMs) },
    })

  return { observed: observations.length, inserted }
}

function summaryFor(kind: InventoryDiscoveryKind, name: string, namespace: string): string {
  if (kind === 'new_tool') {
    return namespace ? `New MCP tool ${namespace}.${name} observed` : `New MCP tool ${name} observed`
  }
  return `New agent ${name} observed`
}
