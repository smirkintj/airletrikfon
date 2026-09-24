import { rm } from "./tnb";

/**
 * Air Selangor domestic tariff, effective 1 September 2025. Tiers are marginal: each block
 * of m³ is charged at its own rate. A minimum charge applies to very low usage.
 */
export const AIR_SELANGOR = {
  effectiveFrom: "2025-09-01",
  // [upper m³ bound of the block, RM/m³]
  tiers: [
    [20, 0.65],
    [35, 1.62],
    [Infinity, 3.51],
  ] as [number, number][],
  minimumCharge: 6.5,
};

export type WaterCharges = { m3: number; blocks: { m3: number; rate: number; amount: number }[]; total: number };

export function computeWaterBill(m3: number): WaterCharges {
  const blocks: WaterCharges["blocks"] = [];
  let from = 0;
  for (const [upTo, rate] of AIR_SELANGOR.tiers) {
    const inBlock = Math.max(0, Math.min(m3, upTo) - from);
    if (inBlock > 0) blocks.push({ m3: inBlock, rate, amount: rm(inBlock * rate) });
    from = upTo;
  }
  const total = rm(blocks.reduce((s, b) => s + b.amount, 0));
  return { m3, blocks, total: Math.max(total, AIR_SELANGOR.minimumCharge) };
}

/** The tier boundary just below `m3`, if usage has crossed one. */
export function tierCrossed(m3: number): { boundary: number; rate: number; firstRate: number } | null {
  const tiers = AIR_SELANGOR.tiers;
  for (let i = tiers.length - 1; i > 0; i--) {
    if (m3 > tiers[i - 1][0]) return { boundary: tiers[i - 1][0], rate: tiers[i][1], firstRate: tiers[0][1] };
  }
  return null;
}
