# Roadmap

# Onboarding & profile setup
- [x] 8-step onboarding wizard (welcome, photo with crop/zoom, info, personal, interests+follows, privacy, preview, complete).
- [x] Live username availability, letters/numbers/underscores, DB-level uniqueness.
- [x] Progress survives refresh/logout (local draft) and resumes at the saved step.
- [x] Auth gate sends incomplete accounts back to onboarding; completed accounts go to the feed.
- [x] Welcome notification + toast on completion; E2E test of the full journey passed.

# Verification & country system (Nov 2026)
- [ ] Migration: app_role enum, user_roles + has_role/is_twiqo_admin, profiles.country, verification_applications, verification_documents, verification_audit_logs (RLS + grants).
- [ ] Private verification-documents bucket with owner/admin access policies.
- [ ] Founder role assigned to joshualee2541@gmail.com (vibelinkofficial).
- [ ] Verification badge turns blue (per Josh Lee request), clickable "Verified by Twiqo".
- [ ] Settings: "Request Verification" entry → application form + status/reapply; "Country" entry to view/change country.
- [ ] Country selection step 0 in onboarding; one-time country prompt for existing users missing a country.
- [ ] Admin dashboard /admin (founder+admin): applications review (approve/reject/request info, docs, search/filter), manual grant/revoke (founder only), audit log.
- [ ] Country analytics dashboard: totals, per-country counts + %, top 10 chart, growth, range filters, CSV export.
- [ ] Verification decision notifications; tests for country helpers; E2E check of the flows.
