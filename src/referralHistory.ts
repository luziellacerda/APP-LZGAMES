// Display-only filters. They never change approval, balances or stored referrals.
export type ReferralHistoryStatus = "completed" | "pending" | "cancelled" | "review" | "all";
type HistoryItem = { name: string; status: string; createdAt: string };

export const HISTORY_PAGE_SIZE = 5;
export const historySearchKey = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("pt-BR");
export function historyStatus(value: string): Exclude<ReferralHistoryStatus, "all"> {
  const key = historySearchKey(value);
  if (["completed", "concluida", "concluido"].includes(key)) return "completed";
  if (["cancelled", "canceled", "cancelada", "cancelado"].includes(key)) return "cancelled";
  if (["pending", "pendente"].includes(key)) return "pending";
  return "review";
}
export const historyStatusLabel: Record<ReferralHistoryStatus, string> = {
  completed: "Concluídas", pending: "Pendentes", cancelled: "Canceladas", review: "Em análise", all: "Todas",
};
export function currentHistoryMonth(now = new Date()): string {
  // The store runs in Maceió. A phone's timezone must not change the default month.
  const parts = new Intl.DateTimeFormat("en", { timeZone: "America/Maceio", year: "numeric", month: "2-digit" }).formatToParts(now);
  return `${parts.find(part => part.type === "year")!.value}-${parts.find(part => part.type === "month")!.value}`;
}
export function historyMonth(value: string): string {
  // SQL timestamps are store-local; explicitly zoned timestamps are converted.
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(value)) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : currentHistoryMonth(date);
  }
  return /^(\d{4}-(?:0[1-9]|1[0-2]))-\d{2}(?:[ T]|$)/.exec(value)?.[1] ?? "";
}
export function historyMonthLabel(value: string): string {
  if (!/^\d{4}-(?:0[1-9]|1[0-2])$/.test(value)) return "Todos os meses";
  return new Date(`${value}-15T12:00:00Z`).toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "America/Maceio" });
}
export function historyMonths(now = new Date()): string[] {
  const first = new Date(now.getTime() - 365 * 86400000);
  const oldest = currentHistoryMonth(first), latest = currentHistoryMonth(now);
  const months: string[] = [];
  const cursor = new Date(`${latest}-15T12:00:00Z`);
  while (months.length < 13) {
    const key = currentHistoryMonth(cursor);
    if (key < oldest) break;
    months.push(key); cursor.setUTCMonth(cursor.getUTCMonth() - 1);
  }
  return months;
}
export function filterReferralHistory<T extends HistoryItem>(items: T[], month: string, status: ReferralHistoryStatus, query: string): T[] {
  const search = historySearchKey(query);
  return items.slice(0, 200).filter(item => (!month || historyMonth(item.createdAt) === month)
    && (status === "all" || historyStatus(item.status) === status)
    && (!search || historySearchKey(item.name).includes(search)));
}
