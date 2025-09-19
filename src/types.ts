export interface Member {
  member_id: string;
  first_name: string;
  last_initial: string;
  photo_url?: string;
  active_state: 'clocked_in' | 'clocked_out' | 'unknown';
}

export interface SessionToggleResponse {
  state: 'clocked_in' | 'clocked_out';
  session_id: string;
  start_ts?: string;
  end_ts?: string;
  minutes?: number;
}

export interface StatusEntry {
  member_id: string;
  is_in: boolean;
  started_at?: string;
  elapsed_sec?: number;
}

export interface OfflineSubmission {
  member_id: string;
  minutes?: number;
  start_ts?: string;
  end_ts?: string;
  category: string;
  note?: string;
}

export interface OfflineHistoryEntry {
  session_id: string;
  type: 'in_person' | 'offline';
  category?: string;
  minutes?: number;
  start_ts?: string;
  end_ts?: string;
  status: 'pending_approval' | 'approved' | 'rejected' | 'open' | 'closed';
  note?: string;
}
