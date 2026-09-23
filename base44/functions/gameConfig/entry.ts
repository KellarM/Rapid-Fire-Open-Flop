import { createClientFromRequest } from 'npm:@base44/sdk@0.8.50';

// Single-record game configuration store (Ante Bonus Structure, etc.).
// Source of truth lives server-side so a change made by the operator on one
// device (desktop) and published applies to every device (mobile), instead
// of being trapped in that browser's localStorage.
//
// Uses the service role for both read and write: the game is a public app
// (no login required to play) and the operator manages config via a hidden
// toolbar hotkey, so we cannot require an authenticated admin session here.
// The hidden hotkey is the gate, same as the previous localStorage design.
const DEFAULT_ANTE_STRUCTURE_ID = 'C';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const action = body.action || 'get';

    // Helper: get the single config record (creates the default if absent)
    const getOrCreate = async () => {
      const list = await base44.asServiceRole.entities.GameConfig.list();
      if (list && list.length > 0) return list[0];
      return await base44.asServiceRole.entities.GameConfig.create({
        anteStructureId: DEFAULT_ANTE_STRUCTURE_ID,
      });
    };

    if (action === 'get') {
      const record = await getOrCreate();
      return Response.json({ anteStructureId: record.anteStructureId || DEFAULT_ANTE_STRUCTURE_ID });
    }

    if (action === 'set') {
      const id = body.anteStructureId;
      if (!id || typeof id !== 'string') {
        return Response.json({ error: 'anteStructureId required' }, { status: 400 });
      }
      const list = await base44.asServiceRole.entities.GameConfig.list();
      let record;
      if (!list || list.length === 0) {
        record = await base44.asServiceRole.entities.GameConfig.create({ anteStructureId: id });
      } else {
        record = await base44.asServiceRole.entities.GameConfig.update(list[0].id, { anteStructureId: id });
      }
      return Response.json({ ok: true, anteStructureId: record.anteStructureId });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}