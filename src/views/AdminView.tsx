import { ChangeEvent, FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { adminApi, offlineApi, rosterApi, statusApi } from '../api';
import { useConfig } from '../state/ConfigContext';
import type { OfflineHistoryEntry } from '../types';

const parseCsv = (text: string) => {
  const lines = text.trim().split(/\r?\n/);
  return lines
    .map((line) => line.split(',').map((value) => value.trim()))
    .filter((row) => row.length >= 2)
    .map(([first_name, last_initial, student_email = '', photo_url = '']) => ({
      first_name,
      last_initial,
      student_email: student_email || undefined,
      photo_url: photo_url || undefined,
    }));
};

export const AdminView = () => {
  const config = useConfig();
  const [teamId, setTeamId] = useState(config.TEAM_IDS[0]?.id ?? '');
  const [selectedMember, setSelectedMember] = useState<string>('');
  const [csvText, setCsvText] = useState('');
  const [filterStatus, setFilterStatus] = useState<'pending_approval' | 'approved' | 'rejected' | 'all'>('pending_approval');

  const rosterQuery = useQuery({
    queryKey: ['admin-roster', teamId],
    queryFn: () => rosterApi.list(config.SEASON_ID, teamId),
    enabled: Boolean(teamId),
  });

  const statusQuery = useQuery({
    queryKey: ['admin-status', teamId],
    queryFn: () => statusApi.now(config.SEASON_ID, teamId),
    enabled: Boolean(teamId),
    refetchInterval: 30_000,
  });

  const historyQuery = useQuery({
    queryKey: ['admin-offline', selectedMember],
    queryFn: () => offlineApi.history(config.SEASON_ID, selectedMember),
    enabled: Boolean(selectedMember),
  });

  const clockoutMutation = useMutation({
    mutationFn: () => adminApi.clockoutAll(config.SEASON_ID, teamId),
    onSuccess: () => statusQuery.refetch(),
  });

  const importMutation = useMutation({
    mutationFn: () => adminApi.importMembers(config.SEASON_ID, teamId, parseCsv(csvText)),
    onSuccess: () => {
      rosterQuery.refetch();
      setCsvText('');
    },
  });

  const approvalMutation = useMutation({
    mutationFn: ({ session_id, action, minutes, note }: { session_id: string; action: 'approve' | 'reject' | 'edit'; minutes?: number; note?: string }) =>
      adminApi.approveOffline(config.SEASON_ID, session_id, action, minutes, note),
    onSuccess: () => historyQuery.refetch(),
  });

  const currentStatus = useMemo(() => {
    if (!statusQuery.data) return {} as Record<string, { is_in: boolean; started_at?: string }>;
    const map: Record<string, { is_in: boolean; started_at?: string }> = {};
    statusQuery.data.forEach((entry) => {
      map[entry.member_id] = { is_in: entry.is_in, started_at: entry.started_at };
    });
    return map;
  }, [statusQuery.data]);

  const filteredOffline = useMemo(() => {
    if (!historyQuery.data) return [] as OfflineHistoryEntry[];
    if (filterStatus === 'all') return historyQuery.data;
    return historyQuery.data.filter((entry) => entry.status === filterStatus);
  }, [historyQuery.data, filterStatus]);

  const handleCsvChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setCsvText(event.target.value);
  };

  const handleApproval = (session_id: string, action: 'approve' | 'reject' | 'edit', minutes?: number) => {
    approvalMutation.mutate({ session_id, action, minutes });
  };

  const handleClockoutAll = (event: FormEvent) => {
    event.preventDefault();
    clockoutMutation.mutate();
  };

  return (
    <section className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h2 className="text-xl font-semibold">Today&apos;s Attendance</h2>
        <form onSubmit={handleClockoutAll} className="mt-4 flex flex-wrap items-center gap-3">
          <select
            value={teamId}
            onChange={(event) => {
              setTeamId(event.target.value);
              setSelectedMember('');
            }}
            className="rounded-lg border border-slate-300 px-3 py-2 focus:border-accent focus:outline-none"
          >
            {config.TEAM_IDS.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-lg bg-danger px-4 py-2 text-white font-semibold shadow disabled:opacity-60"
            disabled={clockoutMutation.isPending}
          >
            {clockoutMutation.isPending ? 'Clocking out…' : 'Clock everyone out'}
          </button>
        </form>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {(rosterQuery.data ?? []).map((member) => {
            const state = currentStatus[member.member_id];
            return (
              <div key={member.member_id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-sm font-semibold">{member.first_name} {member.last_initial}.</div>
                <div className="text-xs text-slate-500">
                  {state?.is_in ? `Clocked in since ${state.started_at ? new Date(state.started_at).toLocaleTimeString() : 'unknown'}` : 'Clocked out'}
                </div>
                <button
                  type="button"
                  className="mt-2 w-full rounded-md bg-accent px-3 py-1 text-sm text-white"
                  onClick={() => setSelectedMember(member.member_id)}
                >
                  Review offline
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <h2 className="text-xl font-semibold">Offline approvals</h2>
        <div className="mt-3 flex items-center gap-3">
          <select
            value={filterStatus}
            onChange={(event) => setFilterStatus(event.target.value as typeof filterStatus)}
            className="rounded-lg border border-slate-300 px-3 py-2 focus:border-accent focus:outline-none"
          >
            <option value="pending_approval">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="all">All</option>
          </select>
          <span className="text-sm text-slate-500">
            Showing {filteredOffline.length} entries for {selectedMember || 'selected student'}
          </span>
        </div>
        {filteredOffline.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No entries to review.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {filteredOffline.map((entry) => (
              <li key={entry.session_id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="font-semibold">{entry.category ?? 'Offline work'}</div>
                    <div className="text-sm text-slate-500">
                      {entry.minutes ?? 0} minutes · {entry.status.replace(/_/g, ' ')}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="rounded-md bg-success px-3 py-2 text-sm text-white"
                      onClick={() => handleApproval(entry.session_id, 'approve')}
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      className="rounded-md bg-danger px-3 py-2 text-sm text-white"
                      onClick={() => handleApproval(entry.session_id, 'reject')}
                    >
                      Reject
                    </button>
                  </div>
                </div>
                {entry.note ? <p className="mt-2 text-sm text-slate-600">Note: {entry.note}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h2 className="text-xl font-semibold">Import members via CSV</h2>
        <p className="mt-1 text-sm text-slate-500">Columns: first_name,last_initial,student_email?,photo_url?</p>
        <textarea
          value={csvText}
          onChange={handleCsvChange}
          rows={6}
          placeholder="Ada,A,ada@example.com,https://photos/ada.jpg"
          className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-accent focus:outline-none"
        />
        <button
          type="button"
          disabled={!csvText || importMutation.isPending}
          onClick={() => importMutation.mutate()}
          className="mt-3 rounded-lg bg-primary px-4 py-2 text-white font-semibold shadow disabled:opacity-60"
        >
          {importMutation.isPending ? 'Importing…' : 'Import members'}
        </button>
        {importMutation.isSuccess ? (
          <p className="mt-2 text-sm text-success">Roster updated!</p>
        ) : null}
        {importMutation.isError ? (
          <p className="mt-2 text-sm text-danger">Import failed. Check CSV format.</p>
        ) : null}
      </div>
    </section>
  );
};
