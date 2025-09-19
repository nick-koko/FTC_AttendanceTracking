## Overview
- Hosting: Static site (GitHub Pages) as a PWA (Kiosk + Student + Admin views).
- Backend: Single Google Apps Script (GAS) Web App, "execute as me", access: Anyone (anonymous), CORS restricted to your GitHub Pages origin.
- Storage: One Google Sheet per season (e.g., Attendance_2025-26).
- Auth model:
  - Kiosk (iPad): No login. Tap name to clock in/out.
  - Student at home: Google Sign-In (preferred) or one-time codes for offline submissions only.
  - Admin: Google Sign-In; email must be on an ADMIN_EMAILS allowlist.

## Google Sheet Schema (one file per season)
Tabs:
1) Seasons (optional if one sheet per season, but useful for metadata)
   - season_id (e.g., 2025-26)
   - start_date, end_date, is_active
2) Teams
   - team_id (e.g., GP, BH)
   - season_id
   - team_name (Giggle Pickles, Blockheads)
   - display_order
3) Members
   - member_id (stable within season; human-readable or UUID)
   - team_id, season_id
   - first_name, last_initial
   - photo_url (optional)
   - student_email (for at-home login)
   - guardian_email (optional)
   - is_active (TRUE/FALSE)
4) Sessions (append-only event log)
   - session_id (UUID)
   - member_id, team_id, season_id
   - source (kiosk | home)
   - type (in_person | offline)
   - start_ts (ISO 8601), end_ts (ISO 8601, nullable)
   - minutes (computed on close or by backend)
   - category (offline only: CAD, Programming, Documentation, Outreach, Other)
   - note (offline reason or link)
   - status (open | closed | pending_approval | approved | rejected)
   - created_by (email or 'kiosk'), created_at, updated_at
   - client_ref (idempotency key from frontend), ua (user agent), ip_hint (string)
5) Meetings (optional)
   - meeting_id, team_id, date, start_planned, end_planned
6) Lookups
   - offline_categories
   - team_codes
7) Views (optional formula tabs)
   - CurrentStatus: latest open/closed per member
   - TotalsPerMember: sums by type/category/date range
   - TotalsPerTeam: attendance rate by meeting

Header rows should be protected. Consider named ranges for each tab's header.

## Key Behaviors and Rules
- One open in-person session per member at a time.
- Kiosk toggle:
  - If no open in-person session: create in_person with start_ts=now.
  - If open in-person session: set end_ts=now, compute minutes, close it.
- Auto clock-out: a nightly time-driven Apps Script closes any open in-person sessions that crossed midnight.
- Offline submissions (home):
  - Require category and minutes (or start/end).
  - Create as type=offline, status=pending_approval.
  - Admin can approve/reject/edit minutes; keep audit trail via updated_by/updated_at.
- Admin can edit start/end for kiosk mistakes; track edits.

## Kiosk (iPad) UI
- Team selector (chips or tabs): Giggle Pickles, Blockheads.
- Grid of large member tiles:
  - Green = clocked in (shows live elapsed mm:ss).
  - Gray = clocked out.
  - Brief pulse animation after a successful toggle.
- Search by typing first letters of the name.
- "Clock everyone out" admin action (hidden behind long-press on team header + admin login).
- Resilience:
  - PWA with local queue if offline; assign a client_ref (UUID) to each toggle; auto-flush on reconnect.
  - Visible offline banner when queueing.

iPad setup: Add to Home Screen, use Guided Access, disable auto-lock during meetings.

## Student (Home) Portal
- Auth: Google Sign-In (preferred; enforce student_email roster match) or one-time codes (single-use tokens bound to member_id and expiry).
- Form fields: date (default today), minutes or start/end, category (required), optional note/link.
- Submits offline session: status=pending_approval.
- Student can see their own history and approval status.

## Admin Portal
- Season switcher.
- Roster management: add/edit members inline; CSV import mapping to Members columns; move student across teams within season.
- Today board: who is in now; manual clock-out.
- Offline approvals: filter by team/category/date; approve/reject/edit minutes.
- Reports/Export:
  - Per member: totals by type, category, date range.
  - Per team: meeting attendance %, average minutes per meeting.
  - CSV export and/or link to the Google Sheet range.

## Apps Script Web App (API Contract)
All endpoints are POST with JSON. Responses use { ok: true, data } or { ok: false, error }. The script runs as the sheet owner and writes to the season sheet. Implement an origin allowlist and basic rate limiting.

1) /api/roster.list
   - Request: { season_id, team_id }
   - Response: { members: [{ member_id, first_name, last_initial, photo_url, active_state }] }

2) /api/session.toggle (kiosk)
   - Request: { member_id, team_id, season_id, client_ref }
   - Response: { state: 'clocked_in' | 'clocked_out', session_id, start_ts?, end_ts?, minutes? }
   - Logic: if open in-person exists then close else open.

3) /api/status.now
   - Request: { team_id, season_id }
   - Response: { entries: [{ member_id, is_in, started_at, elapsed_sec }] }

4) /api/offline.submit (home)
   - Request (signed-in): { member_id?, minutes? or start_ts+end_ts, category, note? }
   - Or with one-time code: { one_time_code, minutes? or start_ts+end_ts, category, note? }
   - Response: { status: 'pending_approval', session_id }

5) /api/offline.review (admin)
   - Request: { session_id, action: 'approve' | 'reject' | 'edit', minutes?, note? }
   - Response: { status }

6) /api/admin.clockout_all (admin)
   - Request: { team_id, season_id }
   - Response: { count_closed }

7) /api/admin.import_members (admin)
   - Request: { season_id, team_id, rows: [{ first_name, last_initial, student_email?, photo_url? }] }
   - Response: { added: n }

## Background Jobs (Apps Script Triggers)
- Nightly auto-clock-out: find open in-person sessions; set end_ts to midnight; compute minutes.
- Weekly export (optional): write CSV snapshots to Drive for archival.

## Security and Anti-abuse
- Kiosk: no login by design.
  - Throttle: max 1 toggle per member per 10 seconds; dedupe via client_ref.
  - Log ua and ip_hint for auditing.
- Home submissions: Google Sign-In or one-time codes; all offline entries start as pending_approval.
- Admin routes: require Google Sign-In; admin email must be in ADMIN_EMAILS script properties.
- CORS: restrict to your GitHub Pages origin.

## Season Rollover
- "Create new season" action:
  - Duplicate sheet from template.
  - Copy Teams and Members; assign new season_id; clear Sessions.
  - Archive prior season sheet as read-only.

## Reporting
- Member Summary: total minutes by type and by category, filterable by date range.
- Team Meeting Attendance: % of roster present during meeting windows.
- Last Seen and streaks.
- CSV export for any report.

## Deployment Plan
1) Create the season Google Sheet with the tabs and headers above.
2) Create a Google Apps Script Web App bound to the sheet or standalone; implement endpoints and triggers; deploy:
   - Execute as: Me (owner)
   - Access: Anyone
   - Add origin allowlist and ADMIN_EMAILS list in script properties.
3) Front-end PWA on GitHub Pages:
   - Config with SEASON_ID, GAS_URL, TEAM_IDS (e.g., GP, BH), optional allowed email domain for student login.
   - Three routes/views: Kiosk, Student, Admin.
   - Local queue for offline; idempotent client_ref; status banner.
4) iPad setup:
   - Add to Home Screen, Guided Access, keep display awake during meetings.

## Acceptance Criteria
- Kiosk: team filter, searchable member grid, tile states, toggle works online/offline with queue and flush, one open session enforced.
- Student: sign-in or one-time code; offline form; history and statuses.
- Admin: CSV roster import; approvals queue; manual clock-out all; per member/team totals; CSV export.
- Integrity: auto midnight clock-out; idempotent API; origin-restricted; basic throttling.

## Nice-to-Have (later)
- Photos on tiles.
- Calendar-aware meeting windows.
- QR badge mode (PIN-less) for faster kiosk flow.