import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import * as profilesService from '@/lib/services/profiles.service';
import * as organizationsService from '@/lib/services/organizations.service';
import { getGeneralManagerTransferErrorMessage } from '@/lib/errorMessages';
import type { Profile } from '@/lib/services/profiles.service';
import { PageLayout } from '@/app/components/layout/PageLayout';

export function TransferGeneralManagerPage() {
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [org, setOrg] = useState<{ id: string; general_manager_id: string | null } | null>(null);

  const [gmTransferTargetId, setGmTransferTargetId] = useState('');
  const [gmTransferSubmitting, setGmTransferSubmitting] = useState(false);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [profs, organization] = await Promise.all([
        profilesService.listUsers(),
        organizationsService.getMyOrganization(),
      ]);
      setProfiles(profs);
      setOrg(organization ? { id: organization.id, general_manager_id: organization.general_manager_id } : null);
    } catch {
      toast.error('فشل تحميل بيانات المدير العام');
    } finally {
      setLoading(false);
    }
  }

  const generalManagerProfile = useMemo(() => {
    if (!org?.general_manager_id) return null;
    return profiles.find((p) => p.id === org.general_manager_id) ?? null;
  }, [org?.general_manager_id, profiles]);

  const gmCandidates = useMemo(() => {
    const currentId = org?.general_manager_id ?? null;
    return profiles.filter((p) => (currentId ? p.id !== currentId : true));
  }, [org?.general_manager_id, profiles]);

  const handleTransferGeneralManager = async () => {
    if (!gmTransferTargetId) return;
    const currentId = org?.general_manager_id ?? null;
    if (gmTransferTargetId === currentId) return;

    setGmTransferSubmitting(true);
    try {
      await organizationsService.transferGeneralManager(gmTransferTargetId);
      toast.success('تم تغيير المدير العام');
      setGmTransferTargetId('');
      await loadData();
    } catch (err) {
      toast.error(getGeneralManagerTransferErrorMessage(err, 'فشل تغيير المدير العام'));
    } finally {
      setGmTransferSubmitting(false);
    }
  };

  return (
    <PageLayout title="تغيير المدير العام" backPath="/more">
      {loading ? (
        <div className="space-y-4">
          <div className="bg-gray-100 rounded-2xl h-16 animate-pulse" />
          <div className="bg-gray-100 rounded-2xl h-20 animate-pulse" />
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <h3 className="text-gray-800 mb-2">تغيير المدير العام</h3>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-xs text-gray-500">المدير العام الحالي</p>
              <p className="text-sm font-medium text-gray-800">
                {generalManagerProfile?.name_ar ?? 'غير محدد'}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={gmTransferTargetId}
                onChange={(e) => setGmTransferTargetId(e.target.value)}
                className="px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 text-gray-700"
                aria-label="اختيار المدير العام الجديد"
              >
                <option value="">-- اختيار --</option>
                {gmCandidates.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name_ar}
                  </option>
                ))}
              </select>

              <button
                type="button"
                disabled={
                  gmTransferSubmitting ||
                  !gmTransferTargetId ||
                  gmTransferTargetId === (org?.general_manager_id ?? null)
                }
                onClick={handleTransferGeneralManager}
                className="px-4 py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl transition-colors"
              >
                {gmTransferSubmitting ? 'جاري التغيير...' : 'تأكيد'}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
}

