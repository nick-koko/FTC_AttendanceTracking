import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { offlineApi, rosterApi } from '../api';
import { useConfig } from '../state/ConfigContext';

interface OfflineFormState {
  member_id: string;
  category: string;
  minutes: number;
  note: string;
}

export const StudentView = () => {
  const config = useConfig();
  const [teamId, setTeamId] = useState(config.TEAM_IDS[0]?.id ?? '');
  const [form, setForm] = useState<OfflineFormState>({
    member_id: '',
    category: config.OFFLINE_CATEGORIES[0] ?? 'Other',
    minutes: 60,
    note: '',
  });

  const { data: roster = [] } = useQuery({
    queryKey: ['roster', config.SEASON_ID, teamId],
    queryFn: () => rosterApi.list(config.SEASON_ID, teamId),
    enabled: Boolean(teamId),
  });

  const memberOptions = useMemo(() => roster.filter((member) => member.active_state !== 'unknown'), [roster]);

  const historyQuery = useQuery({
    queryKey: ['offline-history', form.member_id],
    queryFn: () => offlineApi.history(config.SEASON_ID, form.member_id),
    enabled: Boolean(form.member_id),
  });

  const mutation = useMutation({
    mutationFn: () =>
      offlineApi.submit({
        season_id: config.SEASON_ID,
        member_id: form.member_id,
        minutes: form.minutes,
        category: form.category,
        note: form.note || undefined,
      }),
    onSuccess: () => {
      historyQuery.refetch();
      setForm((prev) => ({ ...prev, note: '' }));
    },
  });

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    mutation.mutate();
  };

  return (
    <section className="max-w-3xl mx-auto px-4 py-8">
      <h2 className="text-xl font-semibold">Log Offline Work</h2>
      <p className="mt-1 text-sm text-slate-500">
        Sign in with your Google account when prompted. Offline work needs coach approval before it is added to
        your totals.
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div>
          <label className="block text-sm font-semibold text-slate-700">Team</label>
          <select
            value={teamId}
            onChange={(event) => {
              setTeamId(event.target.value);
              setForm((prev) => ({ ...prev, member_id: '' }));
            }}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-accent focus:outline-none"
          >
            {config.TEAM_IDS.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700">Student</label>
          <select
            required
            value={form.member_id}
            onChange={(event) => setForm((prev) => ({ ...prev, member_id: event.target.value }))}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-accent focus:outline-none"
          >
            <option value="">Select your name…</option>
            {memberOptions.map((member) => (
              <option key={member.member_id} value={member.member_id}>
                {member.first_name} {member.last_initial}.
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-semibold text-slate-700">Category</label>
            <select
              value={form.category}
              onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-accent focus:outline-none"
            >
              {config.OFFLINE_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700">Minutes</label>
            <input
              type="number"
              min={5}
              max={600}
              step={5}
              value={form.minutes}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, minutes: Number.parseInt(event.target.value, 10) || 0 }))
              }
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-accent focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700">Notes or links (optional)</label>
          <textarea
            value={form.note}
            onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))}
            rows={3}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-accent focus:outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={!form.member_id || mutation.isPending}
          className="w-full rounded-lg bg-success px-4 py-3 text-white font-semibold shadow disabled:opacity-50"
        >
          {mutation.isPending ? 'Submitting…' : 'Submit for approval'}
        </button>
        {mutation.isSuccess ? (
          <p className="text-sm text-success">Submission received! A coach will review it soon.</p>
        ) : null}
        {mutation.isError ? (
          <p className="text-sm text-danger">There was a problem submitting your entry. Try again later.</p>
        ) : null}
      </form>

      {historyQuery.data && historyQuery.data.length > 0 ? (
        <div className="mt-10">
          <h3 className="text-lg font-semibold">Recent offline sessions</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {historyQuery.data.map((item) => (
              <li
                key={item.session_id}
                className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="font-medium">{item.category ?? 'Offline work'}</div>
                  <div className="text-slate-500">
                    {item.minutes ?? 0} minutes · {item.status.replace(/_/g, ' ')}
                  </div>
                </div>
                {item.note ? <div className="mt-2 text-slate-500 sm:mt-0">Note: {item.note}</div> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
};
