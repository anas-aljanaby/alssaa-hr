import React from 'react';
import { useNavigate } from 'react-router';
import { PageLayout } from '../../components/layout/PageLayout';
import {
  BadgeAlert,
  Bot,
  Building2,
  Database,
  FileText,
  LockKeyhole,
  MessageSquare,
  RefreshCw,
  Shield,
  Users,
} from 'lucide-react';

const TERMS_METADATA = {
  lastUpdated: '7 مارس 2026',
  operator: 'شبكة الساعة',
  governingLaw: 'قوانين جمهورية العراق',
  supportEmail: 'support@alssaa.tv',
};

export function TermsPage() {
  const navigate = useNavigate();

  const sections = [
    {
      id: 'acceptance',
      title: 'مقدمة وقبول الشروط',
      icon: FileText,
      paragraphs: [
        'تنظم هذه الشروط والأحكام استخدامك لتطبيق شبكة الساعة بوصفه نظاماً داخلياً لإدارة الحضور والانصراف والإجازات والطلبات الإدارية وسير الموافقات داخل جهة العمل.',
        'يعد استخدام التطبيق أو الوصول إلى أي من خدماته أو بياناته موافقة منك على الالتزام بهذه الشروط وبالسياسات الداخلية المعتمدة لدى الجهة المشغلة. إذا لم تكن موافقاً على هذه الشروط، فيجب عليك التوقف عن استخدام الخدمة.',
      ],
    },
    {
      id: 'definitions',
      title: 'التعريفات',
      icon: Building2,
      paragraphs: [
        'يقصد بالجهة المشغلة: ' + TERMS_METADATA.operator + '. ويقصد بالمستخدم كل شخص مخول له الوصول إلى النظام، سواء كان موظفاً أو مديراً أو مسؤول نظام.',
        'ويقصد بالسجل الوظيفي أو بيانات الحساب: المعلومات التعريفية المرتبطة بالمستخدم مثل الاسم والبريد الإلكتروني والقسم والدور الوظيفي. ويقصد بسجل الحضور أو الطلب: كل عملية أو إدخال أو مستند أو إشعار يتم إنشاؤه أو حفظه داخل النظام.',
      ],
    },
    {
      id: 'access',
      title: 'أهلية الاستخدام والوصول إلى الحساب',
      icon: LockKeyhole,
      paragraphs: [
        'قد يتم إنشاء الحساب من خلال التسجيل الذاتي أو بواسطة مسؤول النظام وفق ما تسمح به الجهة المشغلة. يلتزم المستخدم بتقديم معلومات صحيحة ومحدثة عند إنشاء الحساب أو طلب تعديل بياناته.',
        'المستخدم مسؤول عن الحفاظ على سرية بيانات الدخول الخاصة به وعن جميع الأنشطة التي تتم من خلال حسابه، ويلتزم بإبلاغ مسؤول النظام أو قسم تقنية المعلومات فوراً عند الاشتباه بأي استخدام غير مصرح به.',
      ],
      bullets: [
        'عدم مشاركة كلمة المرور أو رموز التحقق مع أي طرف آخر.',
        'عدم محاولة الوصول إلى بيانات أو وظائف لا تدخل ضمن الصلاحيات الممنوحة للدور الوظيفي.',
        'الالتزام باستخدام الحساب لأغراض العمل أو الأغراض الإدارية المصرح بها فقط.',
      ],
    },
    {
      id: 'service-scope',
      title: 'نطاق الخدمة والاستخدام المسموح',
      icon: Users,
      paragraphs: [
        'يوفر التطبيق وظائف تشغيلية وإدارية تشمل تسجيل الحضور والانصراف، عرض السجلات اليومية والشهرية، تقديم طلبات الإجازة أو الأذونات أو طلبات التعديل الزمني، متابعة الإشعارات، وسير الموافقات من قبل المديرين أو المسؤولين حسب الصلاحيات.',
        'كما قد يتيح النظام وظائف إضافية مرتبطة بإدارة الأقسام والمستخدمين والتقارير والإعدادات التنظيمية، ويقتصر كل ذلك على الصلاحيات الممنوحة لكل دور وظيفي داخل الجهة المشغلة.',
      ],
    },
    {
      id: 'user-obligations',
      title: 'التزامات المستخدم ودقة البيانات',
      icon: BadgeAlert,
      paragraphs: [
        'يلتزم المستخدم بإدخال بيانات صحيحة ودقيقة عند تسجيل الحضور أو تقديم الطلبات أو رفع المرفقات أو تحديث بياناته الشخصية. وتعد السجلات المدخلة عبر النظام جزءاً من السجلات الإدارية الداخلية للجهة المشغلة.',
        'أي استخدام مضلل أو تلاعب متعمد أو رفع مستندات غير صحيحة أو مخالفة للأنظمة المعمول بها قد يترتب عليه رفض الطلب أو تقييد الوصول أو اتخاذ إجراءات إدارية وفق سياسات العمل المعتمدة.',
      ],
      bullets: [
        'تسجيل أوقات الحضور والانصراف بما يعكس الحالة الفعلية.',
        'تقديم مبررات الطلبات والمرفقات بشكل نظامي ومشروع.',
        'مراجعة البيانات قبل الإرسال وتحمل مسؤولية صحتها.',
      ],
    },
    {
      id: 'automation',
      title: 'الموافقات والإجراءات الآلية داخل النظام',
      icon: Bot,
      paragraphs: [
        'يعتمد التطبيق على سير عمل إداري قد يتضمن إشعارات تلقائية، تحديث حالات الطلبات، احتساب أو تعديل بعض الأرصدة ذات الصلة بعد اعتماد الطلبات، أو تنفيذ إجراءات تشغيلية مساندة مثل الإغلاق التلقائي لبعض سجلات الحضور وفق الإعدادات والسياسات المعتمدة.',
        'يوافق المستخدم على أن هذه الإجراءات الآلية تعد جزءاً من تشغيل النظام، ولا تعني بحد ذاتها اتخاذ قرار بشري نهائي خارج ما تقرره الجهة المشغلة أو أصحاب الصلاحية داخلها.',
      ],
    },
    {
      id: 'privacy',
      title: 'البيانات والخصوصية وأمن المعلومات',
      icon: Shield,
      paragraphs: [
        'قد يتعامل النظام مع بيانات الحساب والملف الوظيفي وسجلات الحضور والطلبات والمرفقات والإشعارات وغيرها من البيانات التشغيلية اللازمة لإدارة الموارد البشرية داخل الجهة المشغلة. وتتم معالجة هذه البيانات لأغراض تشغيلية وتنظيمية وأمنية مرتبطة بالخدمة.',
        'تتخذ الجهة المشغلة ومزودوها التقنيون التدابير المعقولة لحماية البيانات، بما في ذلك الاتصال الآمن وإدارة الجلسات والصلاحيات. ولا يتم الإفصاح عن البيانات إلا في حدود الصلاحيات الداخلية أو المتطلبات النظامية أو القانونية الواجبة التطبيق.',
      ],
      note: 'للاطلاع على الملخص المرتبط بالأمان والخصوصية داخل التطبيق، راجع صفحة الأمان والخصوصية.',
    },
    {
      id: 'service-continuity',
      title: 'الملكية الفكرية واستمرارية الخدمة',
      icon: Database,
      paragraphs: [
        'تعود ملكية التطبيق وواجهاته ومحتواه البرمجي والتنظيمي وما يرتبط به من تصميمات ومواد إلى الجهة المشغلة أو الجهات المرخصة لها، ولا يجوز نسخها أو إعادة استخدامها أو إتاحة الوصول إليها خارج حدود الاستخدام المصرح به.',
        'يجوز للجهة المشغلة تحديث التطبيق أو تعديل وظائفه أو تعليق بعض الخدمات أو تقييد الوصول مؤقتاً لأغراض الصيانة أو التطوير أو الأمن أو الامتثال للمتطلبات التشغيلية والتنظيمية.',
      ],
    },
    {
      id: 'liability',
      title: 'الحد من المسؤولية',
      icon: BadgeAlert,
      paragraphs: [
        'يوفر التطبيق أداة تشغيلية وإدارية لتنظيم الحضور والطلبات وسير الإجراءات الداخلية، ولا يشكل بديلاً عن القرارات الإدارية أو التعاقدية أو القانونية أو الاستشارات المهنية المتخصصة.',
        'تطبق التفسيرات والقرارات النهائية المتعلقة بعلاقات العمل أو الصلاحيات أو الاستحقاقات أو الجزاءات وفق الأنظمة والسياسات الداخلية المعتمدة لدى الجهة المشغلة، وبما لا يتعارض مع ' + TERMS_METADATA.governingLaw + '.',
      ],
    },
    {
      id: 'changes',
      title: 'تعديل الشروط',
      icon: RefreshCw,
      paragraphs: [
        'يجوز للجهة المشغلة تعديل هذه الشروط أو تحديثها متى دعت الحاجة، على أن يتم نشر النسخة المحدثة داخل التطبيق أو عبر الوسائل الداخلية المعتمدة مع بيان تاريخ آخر تحديث.',
        'يعد استمرار المستخدم في استخدام التطبيق بعد سريان التحديثات قبولاً بالنسخة الأحدث من الشروط، ما لم تتطلب الجهة المشغلة إجراء موافقة صريحة جديدة.',
      ],
    },
    {
      id: 'contact',
      title: 'التواصل والاستفسارات',
      icon: MessageSquare,
      paragraphs: [
        'للاستفسارات المتعلقة بهذه الشروط أو بطبيعة معالجة البيانات أو استخدام النظام، يمكن التواصل مع مسؤول النظام أو قسم تقنية المعلومات أو عبر البريد الرسمي المعتمد.',
      ],
    },
  ];

  return (
    <PageLayout title="الشروط والأحكام" backPath="/more">
      <div className="space-y-6 pb-20">
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-5 space-y-4 bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 text-white">
          <div className="inline-flex items-center gap-2 self-start px-3 py-1 rounded-full bg-white/10 text-xs">
            <FileText className="w-4 h-4" />
            <span>وثيقة استخدام داخلية</span>
          </div>
          <div className="space-y-2">
            <h1>الشروط والأحكام</h1>
            <p className="text-sm text-slate-200 leading-7">
              توضح هذه الصفحة الأساس النظامي والتنظيمي لاستخدام نظام شبكة الساعة، بما يشمل إدارة
              الحسابات، تسجيل الحضور، الطلبات، الإشعارات، والموافقات الداخلية.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-white/10 px-4 py-3">
              <p className="text-[11px] text-slate-300">تاريخ آخر تحديث</p>
              <p className="mt-1 text-sm">{TERMS_METADATA.lastUpdated}</p>
            </div>
            <div className="rounded-2xl bg-white/10 px-4 py-3">
              <p className="text-[11px] text-slate-300">الجهة المشغلة</p>
              <p className="mt-1 text-sm">{TERMS_METADATA.operator}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
          <span className="text-xs text-gray-500">فهرس سريع</span>
        </div>
        <div className="p-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {sections.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
            >
              {section.title}
            </a>
          ))}
        </div>
      </div>

      {sections.map((section) => (
        <div
          id={section.id}
          key={section.id}
          className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
        >
          <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
            <section.icon className="w-4 h-4 text-gray-500" />
            <span className="text-xs text-gray-500">{section.title}</span>
          </div>
          <div className="p-4 space-y-3 text-sm text-gray-600 leading-7">
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}

            {section.bullets ? (
              <ul className="list-disc list-inside space-y-1 text-gray-600">
                {section.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            ) : null}

            {section.note ? (
              <div className="rounded-2xl bg-emerald-50 border border-emerald-100 px-4 py-3 text-xs text-emerald-800">
                {section.note}
              </div>
            ) : null}
          </div>
        </div>
      ))}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
          <Shield className="w-4 h-4 text-emerald-500" />
          <span className="text-xs text-gray-500">روابط ذات صلة</span>
        </div>
        <div className="p-4 space-y-3">
          <button
            type="button"
            onClick={() => navigate('/security-privacy')}
            className="w-full rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 hover:bg-emerald-100 transition-colors text-right"
          >
            مراجعة صفحة الأمان والخصوصية
          </button>
          <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-600 leading-7">
            <p>البريد الرسمي الحالي في التطبيق:</p>
            <a
              href={`mailto:${TERMS_METADATA.supportEmail}`}
              className="text-emerald-600 underline hover:text-emerald-700"
              dir="ltr"
            >
              {TERMS_METADATA.supportEmail}
            </a>
          </div>
        </div>
      </div>
      </div>
    </PageLayout>
  );
}
