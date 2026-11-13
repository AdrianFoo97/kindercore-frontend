import type { QueryClient } from '@tanstack/react-query';
import { ApiError, apiFetch, withSession } from './client.js';

// Purchase requests — mirrors kindercore-backend's purchase-requests.controller.ts.
// Staff ask for things to be bought; shopping-list managers work through the
// weekly list at Operation → Shopping List.

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

/**
 * REQUESTED = waiting for approval (the requester can still edit / withdraw);
 * APPROVED = confirmed, can be ticked; CANCELLED = withdrawn (never listed).
 */
export type PurchaseStatus = 'REQUESTED' | 'APPROVED' | 'BOUGHT' | 'NOT_BUYING' | 'CANCELLED';

/** The AuthView that makes someone a shopping-list manager (Admin → Views); Admins always are. */
export const PURCHASE_MANAGE_VIEW = 'OPERATION_PURCHASE_MANAGE';

export type PurchaseLogKind = 'REQUESTED' | 'EDITED' | 'CANCELLED' | 'APPROVED' | 'BOUGHT' | 'BACK_TO_LIST' | 'NOT_BUYING' | 'COST' | 'NOTE';

export interface PurchaseLogEntry {
  id: string;
  kind: PurchaseLogKind;
  detail: string | null;
  authorUserId: string;
  authorName: string;
  createdAt: string;
}

export interface PurchaseRequest {
  id: string;
  item: string;
  quantity: string;
  purpose: string;
  note: string | null;
  link: string | null;
  status: PurchaseStatus;
  /** Who buys it: the supervisor, or the requester themselves (then they tick it bought, to be paid back). */
  buyer: PurchaseBuyer;
  /** On the requester's own list: whether a receipt photo was added (the photo itself stays with the office). */
  hasReceipt?: boolean;
  /** RM as a string ("12.50"); only on the shopping list, not the requester's own list. */
  cost?: string | null;
  receipt?: { id: string; mime: string; size: number; name: string } | null;
  declineReason: string | null;
  /** The supervisor's note on the item — the requester sees it too. */
  supervisorNote: string | null;
  supervisorNoteByName: string | null;
  /** Every step, oldest first (add-only record kept by the server). */
  history: PurchaseLogEntry[];
  requestedByUserId: string;
  requestedByName: string;
  handledByName: string | null;
  handledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type PurchaseBuyer = 'SUPERVISOR' | 'SELF';

export interface PurchaseRequestInput {
  buyer: PurchaseBuyer;
  item: string;
  quantity: string;
  purpose: string;
  note: string | null;
  link: string | null;
}

export interface ShoppingList {
  /** Monday of the week shown, 'YYYY-MM-DD'. */
  weekStart: string;
  /** Everything still to buy, oldest first — whenever it was asked for. */
  toBuy: PurchaseRequest[];
  bought: PurchaseRequest[];
  notBuying: PurchaseRequest[];
  /** On that week's list but not bought that week — kept as the week's record (shown for past weeks). */
  carriedOver: PurchaseRequest[];
  spend: { total: number; uncosted: number };
}

/**
 * After any change, refresh both views of the same requests — the
 * supervisor's shopping list and the requester's own list — so an approval
 * (or tick, note, withdraw…) shows up on the other side straight away.
 */
export function refreshPurchaseLists(qc: QueryClient): void {
  qc.invalidateQueries({ queryKey: ['shopping-list'] });
  qc.invalidateQueries({ queryKey: ['my-purchase-requests'] });
}

/**
 * The requester's list always reloads when opened and when the app comes back
 * to the front — the supervisor changes these from another device.
 */
export const MY_REQUESTS_FRESHNESS = { refetchOnMount: 'always', refetchOnWindowFocus: 'always' } as const;

export function requestPurchase(input: PurchaseRequestInput): Promise<PurchaseRequest> {
  return apiFetch<PurchaseRequest>('/api/purchase-requests', { method: 'POST', body: JSON.stringify(input) });
}

export function fetchMyPurchaseRequests(): Promise<PurchaseRequest[]> {
  return apiFetch<PurchaseRequest[]>('/api/purchase-requests/mine');
}

export function fetchShoppingList(weekStart: string): Promise<ShoppingList> {
  return apiFetch<ShoppingList>(`/api/purchase-requests/shopping-list?week=${weekStart}`);
}

export interface BoughtDetails { cost?: string; receipt?: File }
export type SaveBought = (id: string, details?: BoughtDetails) => Promise<PurchaseRequest>;

/** Supervisor: tick bought — or, if already bought, add / change the cost and receipt. */
export const markBought: SaveBought = (id, details) => postBought(`/api/purchase-requests/${id}/bought`, details);

/** Requester: mark their own "I'll buy it myself" item bought, with cost + receipt (to be paid back). */
export const markBoughtMyself: SaveBought = (id, details) => postBought(`/api/purchase-requests/${id}/bought-myself`, details);

/** Multipart so a receipt photo can ride along. */
async function postBought(path: string, details: BoughtDetails = {}): Promise<PurchaseRequest> {
  const form = new FormData();
  if (details.cost !== undefined) form.append('cost', details.cost);
  if (details.receipt) form.append('receipt', details.receipt);
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, withSession({ method: 'POST', body: form }));
  } catch {
    throw new ApiError('Unable to connect to server.', 0, 'NETWORK_ERROR');
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status === 413 ? 'That photo is too large to upload.' : body.message ?? 'Could not save', res.status);
  return body as PurchaseRequest;
}

export function markNotBuying(id: string, reason: string): Promise<PurchaseRequest> {
  return apiFetch<PurchaseRequest>(`/api/purchase-requests/${id}/not-buying`, { method: 'POST', body: JSON.stringify({ reason }) });
}

/** The requester edits their own request — only while it's waiting for approval. */
export function updatePurchaseRequest(id: string, input: PurchaseRequestInput): Promise<PurchaseRequest> {
  return apiFetch<PurchaseRequest>(`/api/purchase-requests/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
}

/** The requester withdraws their own request — only while it's waiting for approval. */
export function withdrawPurchaseRequest(id: string): Promise<void> {
  return apiFetch<void>(`/api/purchase-requests/${id}`, { method: 'DELETE' });
}

export function approvePurchase(id: string): Promise<PurchaseRequest> {
  return apiFetch<PurchaseRequest>(`/api/purchase-requests/${id}/approve`, { method: 'POST' });
}

/** Approve everything waiting for approval. */
export function approveAllPurchases(): Promise<{ approved: number }> {
  return apiFetch<{ approved: number }>('/api/purchase-requests/approve-all', { method: 'POST' });
}

/** Add, change or clear ('') the supervisor's note on an item. */
export function setPurchaseNote(id: string, note: string): Promise<PurchaseRequest> {
  return apiFetch<PurchaseRequest>(`/api/purchase-requests/${id}/note`, { method: 'PUT', body: JSON.stringify({ note }) });
}

export function backToList(id: string): Promise<PurchaseRequest> {
  return apiFetch<PurchaseRequest>(`/api/purchase-requests/${id}/back-to-list`, { method: 'POST' });
}

/** The receipt photo as a Blob — it's private, so an <img src> can't load it directly. */
export async function fetchReceipt(id: string): Promise<Blob> {
  const res = await fetch(`${BASE_URL}/api/purchase-requests/${id}/receipt`, withSession());
  if (!res.ok) throw new ApiError('Could not load the receipt', res.status);
  return res.blob();
}
