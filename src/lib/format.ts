const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** 2026-08-06 → 06 Aug 26 */
export const fmtDate = (iso: string) => `${iso.slice(8, 10)} ${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(2, 4)}`;

/** 1234.5 → 1,234.50 */
export const money = (n: number) => n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** 210000000001 → 2100…0001 */
export const maskAccount = (a: string) => (a.length > 8 ? `${a.slice(0, 4)}…${a.slice(-4)}` : a);
