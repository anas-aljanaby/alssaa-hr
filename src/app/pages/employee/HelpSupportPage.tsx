import React from 'react';
import { useNavigate } from 'react-router';
import { HelpCircle, Mail, FileText, ChevronLeft } from 'lucide-react';

const SUPPORT_EMAIL = 'support@alssaa.tv';

const faqItems = [
  {
    question: 'كيف أسجل الحضور أو الانصراف؟',
    answer:
      'من القائمة الرئيسية اختر "تسجيل الحضور" أو من لوحة التحكم اضغط على زر تسجيل الحضور/الانصراف. تأكد من تسجيل الدخول في بداية الدوام والخروج في نهايته.',
  },
  {
    question: 'كيف أقدم طلب إجازة أو أذن؟',
    answer:
      'اذهب إلى "طلباتي" من القائمة ثم اختر نوع الطلب (إجازة، أذن، تعديل زمني). املأ البيانات والمرفقات إن وجدت وأرسل الطلب لمتابعة الموافقة من مديرك.',
  },
  {
    question: 'أين أرى الإشعارات والموافقات؟',
    answer:
      'من أيقونة الإشعارات في الشريط السفلي أو من "الإشعارات" في صفحة المزيد. تصل إليك تنبيهات بخصوص الطلبات والموافقات والتحديثات.',
  },
  {
    question: 'نسيت كلمة المرور أو أريد تغييرها',
    answer:
      'من "المزيد" اختر "الأمان والخصوصية" لتغيير كلمة المرور من داخل التطبيق. في حال نسيان كلمة المرور تواصل مع مسؤول النظام أو قسم تقنية المعلومات.',
  },
  {
    question: 'من أتصل عند وجود مشكلة تقنية؟',
    answer:
      'يمكنك مراسلة فريق الدعم على البريد الإلكتروني أدناه مع وصف المشكلة ورقم الموظف أو البريد المسجل إن أمكن، وسيتم الرد في أقرب وقت.',
  },
];

export function HelpSupportPage() {
  const navigate = useNavigate();

  return (
    <div className="p-4 max-w-lg mx-auto space-y-6 pb-20">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-2 -m-2 rounded-xl text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          aria-label="رجوع"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className="text-gray-800">المساعدة والدعم</h1>
      </div>

      <p className="text-sm text-gray-600 leading-7">
        تجد هنا إجابات على الأسئلة الشائعة وطريقة التواصل مع فريق الدعم.
      </p>

      {/* أسئلة شائعة */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-amber-500" />
          <span className="text-xs text-gray-500">أسئلة شائعة</span>
        </div>
        <div className="divide-y divide-gray-50">
          {faqItems.map((item, idx) => (
            <div key={idx} className="px-4 py-4">
              <h3 className="text-sm font-medium text-gray-800 mb-1.5">{item.question}</h3>
              <p className="text-xs text-gray-600 leading-6">{item.answer}</p>
            </div>
          ))}
        </div>
      </div>

      {/* تواصل معنا */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
          <Mail className="w-4 h-4 text-emerald-500" />
          <span className="text-xs text-gray-500">تواصل معنا</span>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-sm text-gray-600">
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
      </div>

      {/* روابط ذات صلة */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
          <FileText className="w-4 h-4 text-gray-500" />
          <span className="text-xs text-gray-500">روابط ذات صلة</span>
        </div>
        <div className="p-4 space-y-2">
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
  );
}
