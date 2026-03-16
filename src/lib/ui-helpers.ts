export function getStatusColor(status: string): string {
  switch (status) {
    case 'present':
      return 'bg-emerald-100 text-emerald-700';
    case 'late':
      return 'bg-amber-100 text-amber-700';
    case 'absent':
      return 'bg-red-100 text-red-700';
    case 'on_leave':
      return 'bg-blue-100 text-blue-700';
    case 'overtime_only':
    case 'overtime_offday':
      return 'bg-violet-100 text-violet-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
}

export function getTimeAgoLabel(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 60) return `منذ ${minutes} دقيقة`;
  if (hours < 24) return `منذ ${hours} ساعة`;
  return `منذ ${days} يوم`;
}

