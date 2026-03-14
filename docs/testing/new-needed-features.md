Step	Sections covered	What you're building
1	1.x (already done)	Confirm §1 still passes after schema change
2	2.x (already done)	Confirm §2 still passes
3	§3 Multi-session basic	Add attendance_sessions table + multi-session punch-in/out logic
4	§4 Effective status	Add attendance_daily_summary + effective_status resolution
5	§5 Recalculation triggers	Wire recalculation into every mutation path
6	§8 Overtime requests	Add overtime_requests table + auto-creation logic
7	§7 Early departure	Add is_early_departure flag on checkout
8	§10, §12, §13	Blocking rules, boundary cases, schedule resolution
9	§6 Auto punch-out	Refactor auto-punch-out edge function
10	§9, §14–§17	Session flags, short-day, corrections, audit log
11	§18, §19	Calendar display + regression guards