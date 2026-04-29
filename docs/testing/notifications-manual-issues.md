# Notifications Manual Testing Issues

Manual testing notes collected before the batch fix pass.

## Open Issues

1. Manager-submitted request is visible to that manager in their manager requests page.
   - Context: Manual check item 2.
   - Expected: When a manager submits a request, they should not receive a manager notification for it and should not see that request in the manager requests page.
   - Actual: The manager did not receive a notification, but the request appeared in their requests page.
   - Note: Admin self-requests are different. An admin should not receive a notification for their own request, but should still see it in the requests page and be able to approve it.
   - Status: Fixed in code, pending manual verification.

2. In-progress overtime appears in the requests page before the employee has finished overtime and made the request.
   - Context: Manual overtime check.
   - Expected: Overtime should not notify admins or managers, and should not appear in approver requests pages, until the employee has completed the overtime and the overtime request is actually created/submitted.
   - Actual: The overtime correctly does not notify admins or managers yet, but it is already visible on the requests page.
   - Reason: If the overtime is later auto-rejected for being too short, managers/admins should not be bothered by seeing it early.
   - Status: Fixed in code, pending manual verification.
