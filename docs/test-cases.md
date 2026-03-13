# Test Cases and Edge Cases

This document tracks planned test cases and edge cases in English.

- [ ] = Not implemented yet
- [x] = Implemented

## 1. Punch-In Status Classification

### 1.1 Grace Period Boundaries

| # | Implemented | Punch-In Time | Expected status | Expected `is_overtime` | Notes |
| --- | --- | --- | --- | --- | --- |
| 1.1.1 | [x] | 09:00 | `present` | `false` | Shift start, exactly on time |
| 1.1.2 | [x] | 09:14 | `present` | `false` | 1 minute inside grace |
| 1.1.3 | [x] | 09:15 | `present` | `false` | Grace boundary - inclusive (`<=`) |
| 1.1.4 | [x] | 09:16 | `late` | `false` | First minute after grace ends |
| 1.1.5 | [x] | 09:30 | `late` | `false` | Clearly late |
| 1.1.6 | [x] | 17:59 | `late` | `false` | Still within shift, long after grace |
| 1.1.7 | [x] | 18:00 | `late` | `false` | Exactly at shift end - still within shift (`<=`) |

### 1.2 Early Login Window Boundaries

| # | Implemented | Punch-In Time | Expected status | Expected `is_overtime` | Notes |
| --- | --- | --- | --- | --- | --- |
| 1.2.1 | [x] | 08:00 | `present` | `false` | Exactly at early login window start |
| 1.2.2 | [x] | 08:01 | `present` | `false` | Inside early login window |
| 1.2.3 | [x] | 08:59 | `present` | `false` | Last minute of early login window |
| 1.2.4 | [x] | 07:59 | `present` | `true` | One minute before window - overtime |
| 1.2.5 | [x] | 07:00 | `present` | `true` | Well before window - overtime |

### 1.3 Post-Shift Overtime Boundary

| # | Implemented | Punch-In Time | Expected status | Expected `is_overtime` | Notes |
| --- | --- | --- | --- | --- | --- |
| 1.3.1 | [x] | 18:00 | `late` | `false` | Exactly at shift end - NOT overtime (`>` is strict) |
| 1.3.2 | [x] | 18:01 | `present` | `true` | First minute of overtime zone |
| 1.3.3 | [x] | 20:00 | `present` | `true` | Clearly in post-shift overtime |
| 1.3.4 | [x] | 23:59 | `present` | `true` | End of calendar day |

### 1.4 Overnight / Very Early Punch-In

| # | Implemented | Punch-In Time | Expected status | Expected `is_overtime` | Notes |
| --- | --- | --- | --- | --- | --- |
| 1.4.1 | [x] | 00:00 | `present` | `true` | Midnight - well before early login window |
| 1.4.2 | [x] | 02:00 | `present` | `true` | Early morning overtime |
| 1.4.3 | [x] | 07:59 | `present` | `true` | One minute before window - overtime |
