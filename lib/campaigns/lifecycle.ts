import { CampaignStatus } from "@prisma/client";

const VALID_TRANSITIONS: Record<CampaignStatus, CampaignStatus[]> = {
  [CampaignStatus.DRAFT]: [CampaignStatus.DRY_RUN],
  [CampaignStatus.DRY_RUN]: [CampaignStatus.READY, CampaignStatus.DRAFT],
  [CampaignStatus.READY]: [CampaignStatus.QUEUED, CampaignStatus.DRAFT],
  [CampaignStatus.QUEUED]: [CampaignStatus.SENDING],
  [CampaignStatus.SENDING]: [CampaignStatus.PAUSED, CampaignStatus.COMPLETED],
  [CampaignStatus.PAUSED]: [CampaignStatus.SENDING, CampaignStatus.DRAFT],
  [CampaignStatus.COMPLETED]: [CampaignStatus.ARCHIVED],
  [CampaignStatus.ARCHIVED]: [],
};

export function canTransition(from: CampaignStatus, to: CampaignStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export function getNextStates(current: CampaignStatus): CampaignStatus[] {
  return VALID_TRANSITIONS[current] || [];
}

export function isTerminal(status: CampaignStatus): boolean {
  return status === CampaignStatus.ARCHIVED;
}

export function isActive(status: CampaignStatus): boolean {
  return status === CampaignStatus.SENDING || status === CampaignStatus.QUEUED;
}

export const STATUS_LABELS: Record<CampaignStatus, string> = {
  [CampaignStatus.DRAFT]: "Draft",
  [CampaignStatus.DRY_RUN]: "Dry Run",
  [CampaignStatus.READY]: "Ready",
  [CampaignStatus.QUEUED]: "Queued",
  [CampaignStatus.SENDING]: "Sending",
  [CampaignStatus.PAUSED]: "Paused",
  [CampaignStatus.COMPLETED]: "Completed",
  [CampaignStatus.ARCHIVED]: "Archived",
};

export const STATUS_COLORS: Record<CampaignStatus, string> = {
  [CampaignStatus.DRAFT]: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  [CampaignStatus.DRY_RUN]: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  [CampaignStatus.READY]: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  [CampaignStatus.QUEUED]: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  [CampaignStatus.SENDING]: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  [CampaignStatus.PAUSED]: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  [CampaignStatus.COMPLETED]: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
  [CampaignStatus.ARCHIVED]: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};
