import clsx from 'clsx';
import { useMemo } from 'react';
import type { Member } from '../types';

interface Props {
  member: Member;
  isActive: boolean;
  onToggle: (member: Member) => void;
  startedAt?: string;
}

export const MemberTile = ({ member, isActive, onToggle, startedAt }: Props) => {
  const initials = useMemo(() => `${member.first_name.charAt(0)}${member.last_initial ?? ''}`, [member]);
  const label = `${member.first_name} ${member.last_initial}.`;

  return (
    <button
      type="button"
      className={clsx(
        'relative rounded-xl border-2 p-4 text-left shadow transition-transform focus:outline-none focus-visible:ring-4',
        isActive
          ? 'border-success bg-success/10 text-success hover:scale-105'
          : 'border-slate-200 bg-white text-slate-700 hover:scale-105',
      )}
      onClick={() => onToggle(member)}
    >
      <div className="flex items-center gap-3">
        {member.photo_url ? (
          <img
            src={member.photo_url}
            alt={label}
            className="h-16 w-16 rounded-full border-2 border-white object-cover shadow"
          />
        ) : (
          <div
            className={clsx(
              'flex h-16 w-16 items-center justify-center rounded-full text-xl font-semibold',
              isActive ? 'bg-success text-white' : 'bg-slate-200 text-slate-700',
            )}
            aria-hidden="true"
          >
            {initials}
          </div>
        )}
        <div>
          <div className="text-lg font-semibold">{label}</div>
          <div className="text-sm text-slate-500">
            {isActive ? 'Clocked in' : 'Clocked out'}
            {startedAt ? ` · since ${new Date(startedAt).toLocaleTimeString()}` : ''}
          </div>
        </div>
      </div>
    </button>
  );
};
