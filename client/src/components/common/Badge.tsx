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
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'PROBATION':
      case 'PENDING':
      case 'APPROVED_MANAGER':
      case 'GENERATED':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'LATE':
      case 'HALF_DAY':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'TERMINATED':
      case 'REJECTED':
      case 'SUSPENDED':
      case 'CANCELLED':
      case 'ABSENT':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'ON_LEAVE':
      case 'REMOTE':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const formatted = status.replace(/_/g, ' ');

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${getBadgeStyle(
        status
      )}`}
    >
      {formatted}
    </span>
  );
};
