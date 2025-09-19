import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { kioskApi, rosterApi, statusApi } from '../api';
import { useConfig } from '../state/ConfigContext';
import { Member, StatusEntry } from '../types';
import { MemberTile } from '../components/MemberTile';
import { useOfflineQueue } from '../hooks/useOfflineQueue';

const buildMemberState = (members: Member[], statusEntries: Record<string, { is_in: boolean; started_at?: string }>) =>
  members.map((member) => ({
    ...member,
    is_in: statusEntries[member.member_id]?.is_in ?? false,
    started_at: statusEntries[member.member_id]?.started_at,
  }));

export const KioskView = () => {
  const config = useConfig();
  const [teamId, setTeamId] = useState(config.TEAM_IDS[0]?.id ?? '');
  const [search, setSearch] = useState('');
  const { enqueue, queue, isOnline } = useOfflineQueue(config.SEASON_ID);
  const queryClient = useQueryClient();

  const {
    data: roster = [],
    isLoading: rosterLoading,
    refetch: refetchRoster,
  } = useQuery({
    queryKey: ['roster', config.SEASON_ID, teamId],
    queryFn: () => rosterApi.list(config.SEASON_ID, teamId),
    enabled: Boolean(teamId),
    staleTime: 60_000,
  });

  const {
    data: status = [],
    isLoading: statusLoading,
    refetch: refetchStatus,
  } = useQuery({
    queryKey: ['status', config.SEASON_ID, teamId],
    queryFn: () => statusApi.now(config.SEASON_ID, teamId),
    enabled: Boolean(teamId),
    refetchInterval: 15_000,
  });

  const statusMap = useMemo(() => {
    const map: Record<string, { is_in: boolean; started_at?: string }> = {};
    status.forEach((entry) => {
      map[entry.member_id] = { is_in: entry.is_in, started_at: entry.started_at };
    });
    return map;
  }, [status]);

  const filteredMembers = useMemo(() => {
    const withState = buildMemberState(roster, statusMap);
    if (!search) return withState;
    const lower = search.toLowerCase();
    return withState.filter((member) =>
      `${member.first_name} ${member.last_initial}`.toLowerCase().includes(lower),
    );
  }, [roster, statusMap, search]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      refetchStatus();
    }, 20_000);
    return () => window.clearInterval(interval);
  }, [refetchStatus]);

  const handleToggle = async (member: Member) => {
    if (!navigator.onLine) {
      enqueue(member.member_id, teamId);
      queryClient.setQueryData<Member[]>(['roster', config.SEASON_ID, teamId], (prev) => prev ?? roster);
      queryClient.setQueryData<StatusEntry[]>(['status', config.SEASON_ID, teamId], (prev) => {
        const current = Array.isArray(prev) ? [...prev] : [];
        const existing = current.find((entry) => entry.member_id === member.member_id);
        if (existing) {
          existing.is_in = !existing.is_in;
          existing.started_at = existing.is_in ? new Date().toISOString() : undefined;
        } else {
          current.push({ member_id: member.member_id, is_in: true, started_at: new Date().toISOString() });
        }
        return current;
      });
      return;
    }

    await kioskApi.toggle(config.SEASON_ID, teamId, member.member_id);
    await Promise.all([refetchRoster(), refetchStatus()]);
  };

  if (!teamId) {
    return <div className="p-6 text-center text-slate-600">No teams configured.</div>;
  }

  return (
    <section className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2 flex-wrap">
          {config.TEAM_IDS.map((team) => (
            <button
              key={team.id}
              type="button"
              className={`px-4 py-2 rounded-full text-sm font-semibold shadow ${
                teamId === team.id ? 'bg-accent text-white' : 'bg-white text-slate-700 hover:bg-slate-200'
              }`}
              onClick={() => {
                setTeamId(team.id);
                setSearch('');
              }}
            >
              {team.name}
            </button>
          ))}
        </div>
        <div className="relative">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search student"
            className="w-full rounded-lg border border-slate-300 px-4 py-2 shadow-sm focus:border-accent focus:outline-none"
          />
        </div>
      </div>

      <div className="mt-4 text-sm text-slate-500 flex items-center gap-4">
        <span>Status: {isOnline ? 'Online' : 'Offline'}.</span>
        <span>Pending toggles: {queue.length}</span>
      </div>

      {rosterLoading || statusLoading ? (
        <div className="mt-6 text-slate-500">Loading roster…</div>
      ) : null}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredMembers.map((member) => (
          <MemberTile
            key={member.member_id}
            member={member}
            isActive={statusMap[member.member_id]?.is_in ?? false}
            startedAt={statusMap[member.member_id]?.started_at}
            onToggle={handleToggle}
          />
        ))}
      </div>
    </section>
  );
};
