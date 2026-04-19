# Todo

## Task 1
- [x] Done
- Commit Head: 7895ed5
- Title: Remove sick days entirely
- Explanation:
We don't need sick days in this system at all, we just have regular off days and employees will write inside them the reason for off day, so remove it from everywhere including db, ui, any mention of it at all, make sure to analyze well and find direct and indirect code related to it and proceed accordingly.

## Task 2
- [ ] Done
- Commit Head:
- Title: Check what is happening when a user continues to work after 12 am
- Explanation: Determine the best way to handle post-midnight work, including both overtime and non-overtime cases.

## Task 3
- [ ] Done
- Commit Head:
- Title: Handle very early starts and late stays correctly
- Explanation: Define what should happen when a user starts work very early and continues, or stays after work assuming auto punch-out did not run. In both cases, sessions need to be segmented correctly based on their type and logged properly.

## Task 4
- [ ] Done
- Commit Head:
- Title: Support different shift allocations for the same user
- Explanation:


## Task 5
- [ ] Done
- Commit Head:
- Title: Rework attendance policy page
- Explaination
also add auto punch out rules component 

## Later (Needs Review From Radhwan)

## Task 5
- [ ] Done
- Commit Head:
- Title: Universal settings
- Explanation: Add universal settings for 12/24 hour format, number style (Arabic or English), and month names.
