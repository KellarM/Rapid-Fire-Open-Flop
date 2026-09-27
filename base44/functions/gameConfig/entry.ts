import { createClientFromRequest } from 'npm:@base44/sdk@0.8.50';

// Single-record game configuration store (Ante Bonus Structure, Cascade
// Betting toggle, etc.). Source of truth lives server-side so a change made
// by the operator on one device and published applies to every device,
// instead of being trapped in that browser's localStorage.
//
// Uses the service role for both read and write: the game is a public app
// (no login required to play) and the operator manages config via a hidden
// toolbar hotkey, so we cannot require an authenticated admin session here.
// The hidden hotkey is the gate, same as the previous localStorage design.
const DEFAULT_ANTE_STRUCTURE_ID = 'C';
const DEFAULT_CASCADE_ENABLED = false;
const DEFAULT_RTP_TOOL_ENABLED = false;
const DEFAULT_CARD_RTP_TARGET = 96.5;
const DEFAULT_RANK_RTP_TARGET = 96.5;

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
        cascadeEnabled: DEFAULT_CASCADE_ENABLED,
        rtpToolEnabled: DEFAULT_RTP_TOOL_ENABLED,
        cardRtpTarget: DEFAULT_CARD_RTP_TARGET,
        rankRtpTarget: DEFAULT_RANK_RTP_TARGET,
      });
    };

    if (action === 'get') {
      const record = await getOrCreate();
      return Response.json({
        anteStructureId: record.anteStructureId || DEFAULT_ANTE_STRUCTURE_ID,
        cascadeEnabled: record.cascadeEnabled === true,
        rtpToolEnabled: record.rtpToolEnabled === true,
        cardRtpTarget: typeof record.cardRtpTarget === 'number' ? record.cardRtpTarget : DEFAULT_CARD_RTP_TARGET,
        rankRtpTarget: typeof record.rankRtpTarget === 'number' ? record.rankRtpTarget : DEFAULT_RANK_RTP_TARGET,
      });
    }

    if (action === 'set') {
      const update: Record<string, any> = {};
      if (typeof body.anteStructureId === 'string' && body.anteStructureId) {
        update.anteStructureId = body.anteStructureId;
      }
      if (typeof body.cascadeEnabled === 'boolean') {
        update.cascadeEnabled = body.cascadeEnabled;
      }
      if (typeof body.rtpToolEnabled === 'boolean') {
        update.rtpToolEnabled = body.rtpToolEnabled;
      }
      if (typeof body.cardRtpTarget === 'number' && body.cardRtpTarget > 0 && body.cardRtpTarget <= 100) {
        update.cardRtpTarget = body.cardRtpTarget;
      }
      if (typeof body.rankRtpTarget === 'number' && body.rankRtpTarget > 0 && body.rankRtpTarget <= 100) {
        update.rankRtpTarget = body.rankRtpTarget;
      }
      if (Object.keys(update).length === 0) {
        return Response.json({ error: 'anteStructureId, cascadeEnabled or RTP settings required' }, { status: 400 });
      }
      const list = await base44.asServiceRole.entities.GameConfig.list();
      let record;
      if (!list || list.length === 0) {
        record = await base44.asServiceRole.entities.GameConfig.create({
          anteStructureId: update.anteStructureId || DEFAULT_ANTE_STRUCTURE_ID,
          cascadeEnabled: update.cascadeEnabled !== undefined ? update.cascadeEnabled : DEFAULT_CASCADE_ENABLED,
          rtpToolEnabled: update.rtpToolEnabled !== undefined ? update.rtpToolEnabled : DEFAULT_RTP_TOOL_ENABLED,
          cardRtpTarget: update.cardRtpTarget !== undefined ? update.cardRtpTarget : DEFAULT_CARD_RTP_TARGET,
          rankRtpTarget: update.rankRtpTarget !== undefined ? update.rankRtpTarget : DEFAULT_RANK_RTP_TARGET,
        });
      } else {
        record = await base44.asServiceRole.entities.GameConfig.update(list[0].id, update);
      }
      return Response.json({
        ok: true,
        anteStructureId: record.anteStructureId,
        cascadeEnabled: record.cascadeEnabled === true,
        rtpToolEnabled: record.rtpToolEnabled === true,
        cardRtpTarget: record.cardRtpTarget,
        rankRtpTarget: record.rankRtpTarget,
      });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}