# Test Cases and Edge Cases

This document tracks planned test cases and edge cases in English.

- [ ] = Not implemented yet
- [x] = Implemented

## 1. Punch-In Status Classification

### 1.1 Grace Period Boundaries

| # | Implemented | Punch-In Time | Expected status | Expected `is_overtime` | Notes |
| --- | --- | --- | --- | --- | --- |
| 1.1.1 | [ ] | 09:00 | `present` | `false` | Shift start, exactly on time |
| 1.1.2 | [ ] | 09:14 | `present` | `false` | 1 minute inside grace |
| 1.1.3 | [ ] | 09:15 | `present` | `false` | Grace boundary - inclusive (`<=`) |
| 1.1.4 | [ ] | 09:16 | `late` | `false` | First minute after grace ends |
| 1.1.5 | [ ] | 09:30 | `late` | `false` | Clearly late |
| 1.1.6 | [ ] | 17:59 | `late` | `false` | Still within shift, long after grace |
| 1.1.7 | [ ] | 18:00 | `late` | `false` | Exactly at shift end - still within shift (`<=`) |
