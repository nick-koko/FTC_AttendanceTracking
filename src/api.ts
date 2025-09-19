import { nanoid } from 'nanoid';
import { AppConfig } from './config';
import type { Member, OfflineHistoryEntry, OfflineSubmission, SessionToggleResponse, StatusEntry } from './types';

interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

const baseFetch = async <T>(path: string, body: unknown) => {
  const response = await fetch(`${AppConfig.GAS_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  const json = (await response.json()) as ApiResponse<T>;

  if (!json.ok) {
    throw new Error(json.error || 'Unknown error');
  }

  return json.data as T;
};

export const rosterApi = {
  list: (season_id: string, team_id: string) =>
    baseFetch<{ members: Member[] }>('/api/roster.list', { season_id, team_id }).then((data) =>
      data.members,
    ),
};

export const statusApi = {
  now: (season_id: string, team_id: string) =>
    baseFetch<{ entries: StatusEntry[] }>('/api/status.now', { season_id, team_id }).then((data) =>
      data.entries,
    ),
};

export const kioskApi = {
  toggle: (season_id: string, team_id: string, member_id: string, client_ref?: string) =>
    baseFetch<SessionToggleResponse>('/api/session.toggle', {
      season_id,
      team_id,
      member_id,
      client_ref: client_ref ?? nanoid(),
    }),
};

export const offlineApi = {
  submit: (payload: OfflineSubmission & { season_id: string; team_id?: string }) =>
    baseFetch<{ status: string; session_id: string }>('/api/offline.submit', payload),
  history: (season_id: string, member_id: string) =>
    baseFetch<{ sessions: OfflineHistoryEntry[] }>('/api/offline.history', { season_id, member_id }).then(
      (data) => data.sessions,
    ),
};

export const adminApi = {
  approveOffline: (
    season_id: string,
    session_id: string,
    action: 'approve' | 'reject' | 'edit',
    minutes?: number,
    note?: string,
  ) =>
    baseFetch<{ status: string }>('/api/offline.review', {
      season_id,
      session_id,
      action,
      minutes,
      note,
    }),
  clockoutAll: (season_id: string, team_id: string) =>
    baseFetch<{ count_closed: number }>('/api/admin.clockout_all', { season_id, team_id }),
  importMembers: (
    season_id: string,
    team_id: string,
    rows: { first_name: string; last_initial: string; student_email?: string; photo_url?: string }[],
  ) =>
    baseFetch<{ added: number }>('/api/admin.import_members', { season_id, team_id, rows }),
};
