import React from 'react';

interface BadgeProps {
  status: string;
}

export const Badge: React.FC<BadgeProps> = ({ status }) => {
  const getBadgeStyle = (val: string) => {
    switch (val.toUpperCase()) {
      case 'ACTIVE':
      case 'PRESENT':
      case 'APPROVED_HR':
      case 'PAID':
        return 'bg-emerald-50 text-emerald-800 border-emerald-300';
      case 'PROBATION':
      case 'PENDING':
      case 'APPROVED_MANAGER':
      case 'GENERATED':
        return 'bg-amber-50 text-amber-800 border-amber-300';
      case 'LATE':
      case 'HALF_DAY':
        return 'bg-orange-50 text-[#c73007] border-orange-300';
      case 'TERMINATED':
      case 'REJECTED':
      case 'SUSPENDED':
      case 'CANCELLED':
      case 'ABSENT':
        return 'bg-rose-50 text-rose-800 border-rose-300';
      case 'ON_LEAVE':
      case 'REMOTE':
        return 'bg-slate-100 text-slate-800 border-slate-300';
      default:
        return 'bg-neutral-100 text-neutral-800 border-neutral-300';
    }
  };

  const formatted = status.replace(/_/g, ' ');

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full font-mono text-[10px] font-medium uppercase tracking-wider border ${getBadgeStyle(
        status
      )}`}
    >
      {formatted}
    </span>
  );
};
