import type { UsageInfo } from './usage';

export interface Candidate {
  email: string;
  usage?: UsageInfo;
}

// How used-up an account is: the tighter of its session and weekly limits.
export function load(u: UsageInfo): number {
  return Math.max(u.session ?? 0, u.weekly ?? 0);
}

/** The usable account with the most usage left; ties go to whichever session resets first. */
export function pickBest<T extends Candidate>(candidates: T[]): T | undefined {
  const usable = candidates.filter((c) => c.usage?.status === 'ok');
  usable.sort((a, b) => {
    const diff = load(a.usage!) - load(b.usage!);
    if (diff !== 0) {
      return diff;
    }
    const ra = Date.parse(a.usage!.sessionResetsAt ?? '') || Infinity;
    const rb = Date.parse(b.usage!.sessionResetsAt ?? '') || Infinity;
    return ra - rb;
  });
  return usable[0];
}

export function formatPercent(v: number | undefined): string {
  return v === undefined ? '–' : `${v}%`;
}

export function formatReset(iso: string | undefined, now = Date.now()): string {
  const t = Date.parse(iso ?? '');
  if (!t) {
    return '';
  }
  const mins = Math.max(0, Math.round((t - now) / 60_000));
  if (mins < 60) {
    return `resets in ${mins}m`;
  }
  const hours = Math.floor(mins / 60);
  if (hours < 24) {
    return `resets in ${hours}h ${mins % 60}m`;
  }
  return `resets in ${Math.floor(hours / 24)}d ${hours % 24}h`;
}

export function describeUsage(u: UsageInfo | undefined): string {
  if (!u) {
    return 'checking…';
  }
  if (u.status === 'expired') {
    return 'log in again and re-save';
  }
  if (u.status === 'error') {
    return u.message ?? 'usage unavailable';
  }
  return `session ${formatPercent(u.session)} · weekly ${formatPercent(u.weekly)}`;
}
