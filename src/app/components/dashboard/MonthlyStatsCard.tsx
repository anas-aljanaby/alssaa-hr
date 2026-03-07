import React from 'react';
import { useNavigate } from 'react-router';
import { AlertTriangle } from 'lucide-react';
import type { Profile } from '@/lib/services/profiles.service';

interface MonthlyStatsCardProps {
  employees: Profile[];
  lateCounts: Record<string, number>;
  absentCounts: Record<string, number>;
  title?: string;
}

export function MonthlyStatsCard({
  employees,
  lateCounts,
  absentCounts,
  title = 'إحصائيات التأخر الشهرية',
}: MonthlyStatsCardProps) {
  const navigate = useNavigate();

  return (
    <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="w-5 h-5 text-amber-500" />
        <h3 className="text-gray-800">{title}</h3>
      </div>
      <div className="space-y-2">
        {employees.map((emp) => {
          const lateCount = lateCounts[emp.id] || 0;
          const absentCount = absentCounts[emp.id] || 0;
          return (
            <div
              key={emp.id}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100"
              onClick={() => navigate(`/user-details/${emp.id}`)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') navigate(`/user-details/${emp.id}`);
              }}
            >
              <span className="text-sm text-gray-800">{emp.name_ar}</span>
              <div className="flex items-center gap-3">
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${lateCount >= 3 ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}
                >
                  تأخر: {lateCount}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600">
                  غياب: {absentCount}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
