import React from 'react';
import { useNavigate } from 'react-router';
import { FileText, Shield } from 'lucide-react';

const LAST_UPDATED = 'مارس 2026';

export function TermsPage() {
  const navigate = useNavigate();

  const sections = [
    {
      title: 'قبول الشروط',
      icon: FileText,
      content: (
        <div className="p-4 space-y-3 text-sm text-gray-600">
          <p>
            باستخدامك تطبيق شبكة الساعة (نظام إدارة الحضور والإجازات) فإنك توافق على الالتزام بهذه
            الشروط والأحكام. إن عدم موافقتك يمنعك من استخدام الخدمة.
          </p>
          <p className="text-gray-500 text-xs">
            آخر تحديث: {LAST_UPDATED}. الشركة: شبكة الساعة.
          </p>
        </div>
      ),
    },
    {
      title: 'وصف الخدمة',
      content: (
        <div className="p-4 space-y-3 text-sm text-gray-600">
          <p>
            التطبيق أداة داخلية لتسجيل الحضور والانصراف، وطلب الإجازات، والموافقات من قبل المديرين.
            يتم منح الوصول من قبل المسؤولين المعتمدين فقط، ولا يُقصد بالخدمة الاستخدام خارج نطاق
            المنظمة.
          </p>
        </div>
      ),
    },
    {
      title: 'التزامات المستخدم',
      content: (
        <div className="p-4 space-y-3 text-sm text-gray-600">
          <p>يتعهد المستخدم بما يلي:</p>
          <ul className="list-disc list-inside space-y-1 text-gray-600">
            <li>استخدام بيانات الدخول الخاصة به فقط وعدم مشاركة كلمة المرور.</li>
            <li>تسجيل أوقات الحضور والانصراف بدقة وصدق.</li>
            <li>تقديم طلبات الإجازات بمعلومات صحيحة.</li>
            <li>الإبلاغ فوراً عن أي استخدام غير مصرح به لحسابه.</li>
          </ul>
        </div>
      ),
    },
    {
      title: 'بيانات الحضور والإجازات',
      content: (
        <div className="p-4 space-y-3 text-sm text-gray-600">
          <p>
            تُستخدم بيانات الحضور والإجازات لأغراض إدارة الموارد البشرية والرواتب. وتُعتبر سجلات
            رسمية. أي إدخال كاذب أو تلاعب قد يؤدي إلى إجراءات تأديبية وفق سياسات المنظمة.
          </p>
        </div>
      ),
    },
    {
      title: 'الخصوصية وحماية البيانات',
      icon: Shield,
      content: (
        <div className="p-4 space-y-3 text-sm text-gray-600">
          <p>
            نحمي بياناتك الشخصية عبر اتصال مشفر (HTTPS) وجلسات آمنة. تُستخدم البيانات داخلياً فقط
            لأغراض إدارة الحضور والإجازات ولا تتم مشاركتها مع أطراف خارجية إلا بما يقتضيه القانون.
          </p>
          <p className="text-gray-500 text-xs">
            للتفاصيل الكاملة حول الخصوصية وحماية البيانات، راجع صفحة{' '}
            <button
              type="button"
              onClick={() => navigate('/security-privacy')}
              className="text-emerald-600 underline hover:text-emerald-700"
            >
              الأمان والخصوصية
            </button>
            .
          </p>
        </div>
      ),
    },
    {
      title: 'الأمان والمسؤولية',
      content: (
        <div className="p-4 space-y-3 text-sm text-gray-600">
          <p>
            أنت مسؤول عن الحفاظ على سرية بيانات الدخول الخاصة بك. يُرجى الإبلاغ فوراً عن أي وصول
            غير مصرح به إلى مدير النظام. لا تتحمل الشركة مسؤولية سوء الاستخدام الناتج عن مشاركة
            بيانات الدخول.
          </p>
        </div>
      ),
    },
    {
      title: 'التعديلات على الشروط',
      content: (
        <div className="p-4 space-y-3 text-sm text-gray-600">
          <p>
            تحتفظ شبكة الساعة بحق تحديث هذه الشروط عند الحاجة. استمرارك في استخدام التطبيق بعد
            التحديثات يُعتبر موافقة على الشروط المعدلة. سيتم إخطار المستخدمين بأي تغييرات جوهرية.
          </p>
        </div>
      ),
    },
    {
      title: 'التواصل والدعم',
      content: (
        <div className="p-4 space-y-3 text-sm text-gray-600">
          <p>
            لأي استفسار حول هذه الشروط، يرجى التواصل عبر:{' '}
            <a
              href="mailto:support@alssaa.tv"
              className="text-emerald-600 underline hover:text-emerald-700"
              dir="ltr"
            >
              support@alssaa.tv
            </a>{' '}
            أو مع قسم تقنية المعلومات.
          </p>
        </div>
      ),
    },
  ];

  return (
    <div className="p-4 max-w-lg mx-auto space-y-6 pb-20">
      <h1 className="text-gray-800">الشروط والأحكام</h1>

      {sections.map((section, idx) => (
        <div
          key={idx}
          className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
        >
          <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
            {section.icon ? <section.icon className="w-4 h-4 text-gray-500" /> : null}
            <span className="text-xs text-gray-500">{section.title}</span>
          </div>
          {section.content}
        </div>
      ))}
    </div>
  );
}
