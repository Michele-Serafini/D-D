/**
 * Pure calculation and validation utilities for the D&D Compendium & VTT
 */

export function calcAbilityMod(score: number | string): number {
  const n = typeof score === 'number' ? score : parseInt(String(score), 10) || 10;
  return Math.floor((n - 10) / 2);
}

export function formatModifier(mod: number): string {
  return (mod >= 0 ? '+' : '') + String(mod);
}

export function getRarityCssClass(rarity: string): string {
  return 'rarity-' + String(rarity || '').replace(/\s+/g, '');
}

export function convertCurrencyToCopper(coins: {
  mr?: number;
  ma?: number;
  mo?: number;
  mp?: number;
}): number {
  const mr = Number(coins.mr || 0);
  const ma = Number(coins.ma || 0);
  const mo = Number(coins.mo || 0);
  const mp = Number(coins.mp || 0);
  return mr + ma * 10 + mo * 100 + mp * 1000;
}

export function evaluateD20Roll(
  r1: number,
  r2: number,
  mode: 'normale' | 'vantaggio' | 'svantaggio',
  mod: number
): { natural: number; total: number; isCrit: boolean; isFumble: boolean } {
  const natural =
    mode === 'vantaggio'
      ? Math.max(r1, r2)
      : mode === 'svantaggio'
      ? Math.min(r1, r2)
      : r1;
  return {
    natural,
    total: natural + mod,
    isCrit: natural === 20,
    isFumble: natural === 1
  };
}
