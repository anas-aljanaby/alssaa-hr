### Attendance System – Punching In Page (Draft Policy)

**Purpose**  
Very brief explanation of how the Punching In page works and how time is treated.

---

### Punching In

- **Workday start & grace period**  
  - Each employee has a defined **workday start time**.  
  - There is a **grace period** after this start time where late punches are still allowed (but may still be counted as late, depending on HR rules).

- **Punch In rule**  
  - The employee should **punch in before or within the grace period** to be considered on time.  
  - The **Punch In button is disabled** until **1 hour before** the workday start time.  
  - **Early arrival** (punching in up to 1 hour before shift start) is allowed and **does not count as overtime**.

- **Punch Out / End of Day**  
  - **Manual punch out is required.** The employee must punch out themselves.  
  - Punch out is allowed from shift start through **shift end + configurable buffer** (e.g. 30 minutes after shift end).  
  - **Auto punch-out** is only a **safety net**: if the employee has not punched out by **shift end + buffer**, the system records a punch-out at **shift end** (not current time), marks the record as **auto-completed / missing punch**, sends the employee a notification, and flags the day in the manager dashboard for review.  
  - Auto punch-out records are always flagged so HR and managers know the employee did not confirm the punch-out.

- **Work timer behavior**  
  - After punching in, a **work timer runs** until the employee punches out (manually or by the safety net).

- **Overtime punches**  
  - Punching in **more than 1 hour before** shift start or **after** shift end is recorded as **overtime**.  
  - Punching out **after** the buffer period following shift end is recorded as **overtime**.  
  - If the employee punches out (manually or via safety net), the **Punch In button becomes available again** for overtime entry (subject to company overtime approval rules).
