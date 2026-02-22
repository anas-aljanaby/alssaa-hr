-- ============================================================
-- ALSSAA HR — Seed Demo Organization
-- Creates demo auth users, departments, attendance logs,
-- leave requests, notifications, and leave balance usage.
-- All demo data belongs to org 22222222-2222-2222-2222-222222222222.
--
-- Password for every demo account: DemoPass123!
-- ============================================================

do $$
declare
  _demo_org  uuid := '22222222-2222-2222-2222-222222222222';
  _pw_hash   text;

  -- department IDs
  _dept_news uuid := 'dddd0001-0000-0000-0000-000000000001';
  _dept_tech uuid := 'dddd0002-0000-0000-0000-000000000002';
  _dept_mktg uuid := 'dddd0003-0000-0000-0000-000000000003';
  _dept_hr   uuid := 'dddd0004-0000-0000-0000-000000000004';

  -- user IDs (deterministic so we can reference them)
  _admin     uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  _mgr_news  uuid := 'aaaaaaaa-0000-0000-0000-000000000002';
  _mgr_tech  uuid := 'aaaaaaaa-0000-0000-0000-000000000003';
  _emp1      uuid := 'aaaaaaaa-0000-0000-0000-000000000101';
  _emp2      uuid := 'aaaaaaaa-0000-0000-0000-000000000102';
  _emp3      uuid := 'aaaaaaaa-0000-0000-0000-000000000103';
  _emp4      uuid := 'aaaaaaaa-0000-0000-0000-000000000104';
  _emp5      uuid := 'aaaaaaaa-0000-0000-0000-000000000105';
  _emp6      uuid := 'aaaaaaaa-0000-0000-0000-000000000106';
  _emp7      uuid := 'aaaaaaaa-0000-0000-0000-000000000107';
  _emp8      uuid := 'aaaaaaaa-0000-0000-0000-000000000108';
  _emp9      uuid := 'aaaaaaaa-0000-0000-0000-000000000109';
  _emp10     uuid := 'aaaaaaaa-0000-0000-0000-000000000110';
  _emp11     uuid := 'aaaaaaaa-0000-0000-0000-000000000111';
  _emp12     uuid := 'aaaaaaaa-0000-0000-0000-000000000112';
  _emp13     uuid := 'aaaaaaaa-0000-0000-0000-000000000113';
  _emp14     uuid := 'aaaaaaaa-0000-0000-0000-000000000114';
  _emp15     uuid := 'aaaaaaaa-0000-0000-0000-000000000115';

  -- loop vars for attendance generation
  _d         date;
  _uid       uuid;
  _r         float;
  _status    text;
  _ci        time;
  _co        time;
begin
  -- --------------------------------------------------------
  -- 0. Hash the shared demo password once
  -- --------------------------------------------------------
  _pw_hash := extensions.crypt('DemoPass123!', extensions.gen_salt('bf'));

  -- --------------------------------------------------------
  -- 1. Attendance policy for demo org
  -- --------------------------------------------------------
  insert into public.attendance_policy (org_id, work_start_time, work_end_time,
    grace_period_minutes, weekly_off_days, max_late_days_before_warning,
    absent_cutoff_time, annual_leave_per_year, sick_leave_per_year)
  values (_demo_org, '08:00', '16:00', 15, '{5,6}', 3, '12:00', 21, 10);

  -- --------------------------------------------------------
  -- 2. Departments
  -- --------------------------------------------------------
  insert into public.departments (id, org_id, name, name_ar) values
    (_dept_news, _demo_org, 'News Department',      'قسم الأخبار'),
    (_dept_tech, _demo_org, 'Technical Department',  'القسم التقني'),
    (_dept_mktg, _demo_org, 'Marketing Department',  'قسم التسويق'),
    (_dept_hr,   _demo_org, 'HR Department',         'قسم الموارد البشرية');

  -- --------------------------------------------------------
  -- 3. Helper: insert one demo auth user + identity
  -- --------------------------------------------------------
  create or replace function _seed_demo_user(
    _id uuid, _email text, _pw text, _meta jsonb
  ) returns void language plpgsql as $fn$
  begin
    insert into auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, last_sign_in_at, recovery_sent_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) values (
      _id, '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated',
      _email, _pw, now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      _meta, now(), now(),
      '', '', '', ''
    );

    insert into auth.identities (
      id, user_id, provider_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) values (
      _id, _id, _id::text,
      format('{"sub":"%s","email":"%s"}', _id::text, _email)::jsonb,
      'email', now(), now(), now()
    );
  end;
  $fn$;

  -- --------------------------------------------------------
  -- 3a. Create auth users (trigger auto-creates profiles + leave_balances)
  -- --------------------------------------------------------
  perform _seed_demo_user(_admin,    'demo-admin@alssaa.tv',    _pw_hash, jsonb_build_object('name','Demo Admin','name_ar','مسؤول النظام التجريبي','phone','+964 770 900 0001','role','admin','employee_id','DEMO-001','org_id',_demo_org,'department_id',_dept_hr));
  perform _seed_demo_user(_mgr_news, 'demo-mgr-news@alssaa.tv', _pw_hash, jsonb_build_object('name','Khalid Abdulrahman','name_ar','خالد عبد الرحمن','phone','+964 770 900 0002','role','manager','employee_id','DEMO-002','org_id',_demo_org,'department_id',_dept_news));
  perform _seed_demo_user(_mgr_tech, 'demo-mgr-tech@alssaa.tv', _pw_hash, jsonb_build_object('name','Nadia Hussein','name_ar','نادية حسين','phone','+964 770 900 0003','role','manager','employee_id','DEMO-003','org_id',_demo_org,'department_id',_dept_tech));
  perform _seed_demo_user(_emp1,  'demo-emp1@alssaa.tv',  _pw_hash, jsonb_build_object('name','Omar Al-Jubouri','name_ar','عمر الجبوري','phone','+964 770 900 0101','role','employee','employee_id','DEMO-101','org_id',_demo_org,'department_id',_dept_news));
  perform _seed_demo_user(_emp2,  'demo-emp2@alssaa.tv',  _pw_hash, jsonb_build_object('name','Zahra Kamel','name_ar','زهراء كامل','phone','+964 770 900 0102','role','employee','employee_id','DEMO-102','org_id',_demo_org,'department_id',_dept_news));
  perform _seed_demo_user(_emp3,  'demo-emp3@alssaa.tv',  _pw_hash, jsonb_build_object('name','Hussein Fadhel','name_ar','حسين فاضل','phone','+964 770 900 0103','role','employee','employee_id','DEMO-103','org_id',_demo_org,'department_id',_dept_news));
  perform _seed_demo_user(_emp4,  'demo-emp4@alssaa.tv',  _pw_hash, jsonb_build_object('name','Rana Mahmoud','name_ar','رنا محمود','phone','+964 770 900 0104','role','employee','employee_id','DEMO-104','org_id',_demo_org,'department_id',_dept_news));
  perform _seed_demo_user(_emp5,  'demo-emp5@alssaa.tv',  _pw_hash, jsonb_build_object('name','Saad Abbas','name_ar','سعد عباس','phone','+964 770 900 0105','role','employee','employee_id','DEMO-105','org_id',_demo_org,'department_id',_dept_tech));
  perform _seed_demo_user(_emp6,  'demo-emp6@alssaa.tv',  _pw_hash, jsonb_build_object('name','Maysaa Tariq','name_ar','ميساء طارق','phone','+964 770 900 0106','role','employee','employee_id','DEMO-106','org_id',_demo_org,'department_id',_dept_tech));
  perform _seed_demo_user(_emp7,  'demo-emp7@alssaa.tv',  _pw_hash, jsonb_build_object('name','Basem Khalil','name_ar','باسم خليل','phone','+964 770 900 0107','role','employee','employee_id','DEMO-107','org_id',_demo_org,'department_id',_dept_tech));
  perform _seed_demo_user(_emp8,  'demo-emp8@alssaa.tv',  _pw_hash, jsonb_build_object('name','Huda Salem','name_ar','هدى سالم','phone','+964 770 900 0108','role','employee','employee_id','DEMO-108','org_id',_demo_org,'department_id',_dept_tech));
  perform _seed_demo_user(_emp9,  'demo-emp9@alssaa.tv',  _pw_hash, jsonb_build_object('name','Ahmed Rashid','name_ar','أحمد رشيد','phone','+964 770 900 0109','role','employee','employee_id','DEMO-109','org_id',_demo_org,'department_id',_dept_mktg));
  perform _seed_demo_user(_emp10, 'demo-emp10@alssaa.tv', _pw_hash, jsonb_build_object('name','Layla Ammar','name_ar','ليلى عمار','phone','+964 770 900 0110','role','employee','employee_id','DEMO-110','org_id',_demo_org,'department_id',_dept_mktg));
  perform _seed_demo_user(_emp11, 'demo-emp11@alssaa.tv', _pw_hash, jsonb_build_object('name','Mohammed Nouri','name_ar','محمد نوري','phone','+964 770 900 0111','role','employee','employee_id','DEMO-111','org_id',_demo_org,'department_id',_dept_mktg));
  perform _seed_demo_user(_emp12, 'demo-emp12@alssaa.tv', _pw_hash, jsonb_build_object('name','Sara Kareem','name_ar','سارة كريم','phone','+964 770 900 0112','role','employee','employee_id','DEMO-112','org_id',_demo_org,'department_id',_dept_mktg));
  perform _seed_demo_user(_emp13, 'demo-emp13@alssaa.tv', _pw_hash, jsonb_build_object('name','Yusuf Haider','name_ar','يوسف حيدر','phone','+964 770 900 0113','role','employee','employee_id','DEMO-113','org_id',_demo_org,'department_id',_dept_hr));
  perform _seed_demo_user(_emp14, 'demo-emp14@alssaa.tv', _pw_hash, jsonb_build_object('name','Fatima Ali','name_ar','فاطمة علي','phone','+964 770 900 0114','role','employee','employee_id','DEMO-114','org_id',_demo_org,'department_id',_dept_hr));
  perform _seed_demo_user(_emp15, 'demo-emp15@alssaa.tv', _pw_hash, jsonb_build_object('name','Karrar Adel','name_ar','كرار عادل','phone','+964 770 900 0115','role','employee','employee_id','DEMO-115','org_id',_demo_org,'department_id',_dept_hr));

  drop function _seed_demo_user;

  -- --------------------------------------------------------
  -- 4. Set department managers
  -- --------------------------------------------------------
  update public.departments set manager_uid = _mgr_news where id = _dept_news;
  update public.departments set manager_uid = _mgr_tech where id = _dept_tech;
  update public.departments set manager_uid = _admin    where id = _dept_hr;

  -- --------------------------------------------------------
  -- 5. Attendance logs — last 30 days, reproducible random
  -- --------------------------------------------------------
  perform setseed(0.42);

  for _uid in
    select unnest(array[
      _mgr_news, _mgr_tech,
      _emp1, _emp2, _emp3, _emp4, _emp5, _emp6, _emp7, _emp8,
      _emp9, _emp10, _emp11, _emp12, _emp13, _emp14, _emp15
    ])
  loop
    for _d in
      select d::date from generate_series(
        current_date - 30, current_date, '1 day'::interval
      ) as d
    loop
      -- skip Fri (5) and Sat (6)
      if extract(dow from _d) in (5, 6) then continue; end if;

      _r := random();
      _ci := null;
      _co := null;

      if _r < 0.60 then
        _status := 'present';
        _ci := make_time(8, floor(random() * 12)::int, 0);
        _co := make_time(16 + floor(random() * 2)::int, floor(random() * 60)::int, 0);
      elsif _r < 0.82 then
        _status := 'late';
        _ci := make_time(9 + floor(random() * 2)::int, floor(random() * 60)::int, 0);
        _co := make_time(16 + floor(random() * 2)::int, floor(random() * 60)::int, 0);
      elsif _r < 0.93 then
        _status := 'absent';
      else
        _status := 'on_leave';
      end if;

      insert into public.attendance_logs
        (org_id, user_id, date, check_in_time, check_out_time, status,
         check_in_lat, check_in_lng, check_out_lat, check_out_lng)
      values
        (_demo_org, _uid, _d, _ci, _co, _status,
         case when _ci is not null then 33.3152 end,
         case when _ci is not null then 44.3661 end,
         case when _co is not null then 33.3152 end,
         case when _co is not null then 44.3661 end);
    end loop;
  end loop;

  -- --------------------------------------------------------
  -- 6. Leave requests (mixed statuses)
  -- --------------------------------------------------------
  insert into public.leave_requests
    (org_id, user_id, type, from_date_time, to_date_time, note, status) values
    (_demo_org, _emp1, 'annual_leave',
     (current_date + 3) + time '08:00', (current_date + 5) + time '16:00',
     'إجازة عائلية', 'pending'),
    (_demo_org, _emp3, 'annual_leave',
     (current_date + 10) + time '08:00', (current_date + 14) + time '16:00',
     'سفر خارج البلاد', 'pending'),
    (_demo_org, _emp5, 'hourly_permission',
     (current_date + 1) + time '14:00', (current_date + 1) + time '16:00',
     'موعد في السفارة', 'pending'),
    (_demo_org, _emp11, 'annual_leave',
     (current_date + 5) + time '08:00', (current_date + 6) + time '16:00',
     'مناسبة عائلية', 'pending');

  insert into public.leave_requests
    (org_id, user_id, type, from_date_time, to_date_time, note, status,
     approver_id, decision_note) values
    (_demo_org, _emp2, 'sick_leave',
     (current_date - 5) + time '08:00', (current_date - 5) + time '16:00',
     'مراجعة طبية', 'approved', _mgr_news, 'تمت الموافقة، سلامات'),
    (_demo_org, _emp6, 'sick_leave',
     (current_date - 2) + time '08:00', (current_date - 1) + time '16:00',
     'حالة صحية طارئة', 'approved', _mgr_tech, 'سلامات');

  insert into public.leave_requests
    (org_id, user_id, type, from_date_time, to_date_time, note, status,
     approver_id, decision_note) values
    (_demo_org, _emp9, 'time_adjustment',
     (current_date - 7) + time '08:00', (current_date - 7) + time '08:30',
     'نسيت تسجيل الحضور - كنت موجود من الساعة 8', 'rejected',
     _mgr_news, 'لم يتم التأكد من الحضور');

  -- --------------------------------------------------------
  -- 7. Update leave balances with realistic usage
  -- --------------------------------------------------------
  update public.leave_balances set
    used_annual = 3, remaining_annual = 18, used_sick = 1, remaining_sick = 9
  where user_id in (_emp1, _emp5, _emp9, _emp13);

  update public.leave_balances set
    used_annual = 5, remaining_annual = 16, used_sick = 2, remaining_sick = 8
  where user_id in (_emp2, _emp6, _emp10, _emp14);

  update public.leave_balances set
    used_annual = 7, remaining_annual = 14, used_sick = 0, remaining_sick = 10
  where user_id in (_emp3, _emp7, _emp11, _emp15);

  update public.leave_balances set
    used_annual = 1, remaining_annual = 20, used_sick = 3, remaining_sick = 7
  where user_id in (_emp4, _emp8, _emp12);

  -- --------------------------------------------------------
  -- 8. Notifications
  -- --------------------------------------------------------
  insert into public.notifications
    (org_id, user_id, title, title_ar, message, message_ar, type, read_status) values
    (_demo_org, _emp1,
     'Leave Request Update', 'تحديث طلب الإجازة',
     'Your annual leave request is pending review',
     'طلب إجازتك السنوية قيد المراجعة',
     'request_update', false),
    (_demo_org, _emp1,
     'Late Arrival Warning', 'تنبيه تأخر',
     'You have been late 3 times this month',
     'لقد تأخرت 3 مرات هذا الشهر',
     'attendance', false),
    (_demo_org, _mgr_news,
     'New Leave Request', 'طلب إجازة جديد',
     'Omar Al-Jubouri submitted an annual leave request',
     'عمر الجبوري قدم طلب إجازة سنوية',
     'approval', false),
    (_demo_org, _mgr_news,
     'Pending Approval', 'بانتظار الموافقة',
     'You have 2 pending requests to review',
     'لديك طلبان بانتظار المراجعة',
     'approval', true),
    (_demo_org, _admin,
     'System Update', 'تحديث النظام',
     'Demo organization seeded successfully',
     'تم تهيئة المنظمة التجريبية بنجاح',
     'system', false),
    (_demo_org, _emp2,
     'Leave Approved', 'تمت الموافقة على الإجازة',
     'Your sick leave has been approved',
     'تمت الموافقة على إجازتك المرضية',
     'request_update', false),
    (_demo_org, _mgr_tech,
     'New Leave Request', 'طلب إجازة جديد',
     'Saad Abbas submitted a sick leave request',
     'سعد عباس قدم طلب إجازة مرضية',
     'approval', false);

  raise notice 'Demo seed complete: 18 users, 4 departments, attendance, requests, notifications.';
end;
$$;
