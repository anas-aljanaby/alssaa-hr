import React from 'react';
import { useNavigate } from 'react-router';
import { HelpCircle, Mail, FileText, Clock } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../../components/ui/accordion';
import { PageLayout } from '../../components/layout/PageLayout';
import {
  helpCategories,
  SUPPORT_EMAIL,
} from '../../data/helpContent';

const categoryIcons: Record<string, React.ReactNode> = {
  attendance: <Clock className="w-4 h-4 text-blue-500" />,
  requests: <FileText className="w-4 h-4 text-indigo-500" />,
  account: <HelpCircle className="w-4 h-4 text-purple-500" />,
  contact: <Mail className="w-4 h-4 text-emerald-500" />,
};

export function HelpSupportPage() {
  const navigate = useNavigate();

  return (
    <PageLayout title="المساعدة والدعم" backPath="/more">
      <div className="space-y-6 pb-20">
        <p className="text-sm text-gray-600 leading-7">
          تصفح المواضيع أدناه للوصول السريع إلى ما تحتاجه. لمعرفة إعدادات الحضور (فترة السماح والتأخر) راجع صفحة سياسة الحضور من المزيد.
        </p>

        {helpCategories.map((category) => (
          <div
            key={category.id}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
          >
            <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
              {categoryIcons[category.id] ?? <HelpCircle className="w-4 h-4 text-amber-500" />}
              <span className="text-xs font-medium text-gray-700">{category.titleAr}</span>
            </div>
            <Accordion type="multiple" className="w-full">
              {category.items.map((item, idx) => (
                <AccordionItem key={idx} value={`${category.id}-${idx}`} className="px-4 border-b border-gray-50 last:border-b-0">
                  <AccordionTrigger className="py-3 text-sm font-medium text-gray-800 hover:no-underline [&[data-state=open]>svg]:rotate-180">
                    {item.titleAr}
                  </AccordionTrigger>
                  <AccordionContent className="pb-4">
                    <p className="text-xs text-gray-600 leading-6 mb-3">{item.bodyAr}</p>
                    {item.link && (
                      <button
                        type="button"
                        onClick={() => navigate(item.link!.path)}
                        className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline"
                      >
                        اذهب إلى {item.link.labelAr} →
                      </button>
                    )}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
            {category.id === 'contact' && (
              <div className="p-4 border-t border-gray-100 bg-gray-50/50">
                <p className="text-sm text-gray-600 mb-3">
                  للاستفسارات التقنية أو شكاوى الاستخدام، راسلنا على:
                </p>
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className="flex items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 hover:bg-emerald-100 transition-colors"
                  dir="ltr"
                >
                  <Mail className="w-4 h-4 shrink-0" />
                  {SUPPORT_EMAIL}
                </a>
              </div>
            )}
          </div>
        ))}

        {/* روابط ذات صلة */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
            <FileText className="w-4 h-4 text-gray-500" />
            <span className="text-xs text-gray-500">روابط ذات صلة</span>
          </div>
          <div className="p-4 space-y-2">
            <button
              type="button"
              onClick={() => navigate('/attendance-policy')}
              className="w-full rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-700 hover:bg-gray-100 transition-colors text-right flex items-center gap-2"
            >
              <Clock className="w-4 h-4 text-slate-500" />
              سياسة الحضور
            </button>
            <button
              type="button"
              onClick={() => navigate('/terms-conditions')}
              className="w-full rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-700 hover:bg-gray-100 transition-colors text-right"
            >
              الشروط والأحكام
            </button>
            <button
              type="button"
              onClick={() => navigate('/security-privacy')}
              className="w-full rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-700 hover:bg-gray-100 transition-colors text-right"
            >
              الأمان والخصوصية
            </button>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
