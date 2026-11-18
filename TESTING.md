# DirectLet: what is built, and how to test each part

Test everything on your laptop first, then repeat the short "on the live site" checks.

## Start it on your laptop

Your other project uses ports 4000 and 5173, so DirectLet uses 4100 and 5199.

Window 1, the API:

```powershell
cd C:\Users\atans\Desktop\DirectLet\apps\api
$env:PORT = "4100"; $env:WEB_ORIGIN = "http://localhost:5199"; pnpm dev
```

Window 2, the website:

```powershell
cd C:\Users\atans\Desktop\DirectLet\apps\web
$env:VITE_API_URL = "http://localhost:4100"; pnpm exec vite --port 5199 --strictPort
```

Open **http://localhost:5199** (not 5173 or 4000: those are your other project).

Optional settings go in `apps\api\.env` (see DEPLOY.md): `HCAPTCHA_SITEKEY`, `HCAPTCHA_SECRET`,
`RESEND_API_KEY`. Leave them out to test without the robot check and without email.

Accounts you need (sign up with fake emails such as `test.landlord1@example.com`):

- a **landlord**
- a **house hunter** (choose "I'm looking for a home")
- an **admin**: sign up a hunter, then run
  `pnpm --filter @directlet/api admin:grant that-email@example.com` from the project root, and log in again

## 1. Sign-up robot check (hCaptcha)

Needs `HCAPTCHA_SITEKEY` + `HCAPTCHA_SECRET`.

1. Open `/register`. You should see "Are you a robot?" with an "I am human" box.
2. "Create account" stays grey until you tick it.
3. hCaptcha shows picture puzzles only when it distrusts the visitor; a normal person often just ticks.
4. `/api/auth/config` shows your site key. With no keys it shows `null` and there is no check.

## 2. Login page

1. Open `/login`. Desktop: blue panel with the logo on the left, form on the right. Phone: just the form.

## 3. Landlord verification (with CAC)

1. Landlord: sidebar "Get verified". Choose "company", pick RC/BN/IT, type the number (`RC 1234567` is saved as digits) and the registered name, then Save.
2. Upload ID, proof of ownership, and (company) CAC certificate. A `.txt` file is refused.
3. Admin: **Verify** tab. Open the application, open the documents, click "Open the CAC public search" and compare.
4. Approve (blocked if a document is missing) or Reject with a reason. The landlord sees the reason and can send it again.
5. Public: the listing shows "Verified owner/business" (companies also show the CAC number). Verified landlords are listed first.

## 4. Photos

1. Landlord: open a property, "Photos" section. Add several pictures at once; choose "The whole property" or one flat.
2. A big phone photo (over 1.5 MB) is shrunk before upload. A PDF or text file is refused. Maximum 12.
3. "Make cover" moves one first; "Remove" deletes.
4. Another landlord uploading the identical file is refused (stolen-photo check; edited copies are not caught).
5. Public: listing cards show the cover and "3 photos"; the listing page has a gallery.

## 5. Price breakdown

1. Landlord: add or edit a flat, fill "Other costs to move in" (caution, agreement, service, agency). Enter 0 for "none"; leave blank for "not decided".
2. Public listing page: rent, each fee ("Ask landlord" when blank, "None" for 0) and **Total to move in**.

## 6. "Still available" (freshness)

1. Landlord: each vacant flat shows "Available · confirmed today" and a "Still available" button, plus "Confirm every flat".
2. After 14 days the dashboard asks the landlord to confirm; after 30 days the flat shows "Not confirmed" to visitors and cannot take viewing requests.
3. To test without waiting, run `scripts\test-verification.ps1` (it moves the date for you).

## 7. Viewing requests

1. Signed out, click "Request a viewing": you are asked to log in or sign up, then returned to the listing.
2. Hunter: fill phone (+ optional date, message) and send. Asking twice for one flat is refused; a 6th open request is refused.
3. Landlord: "Inspections". You see the name only; phone and email are hidden until you "Accept and set date".
4. Landlord can "Move date" (counted and shown to the visitor), "Decline", "Mark complete".
5. Hunter: **My viewings** shows status, date, rent-change notice (change the flat's rent after asking to see it), "Cancel request".
6. After the viewing day has passed: landlord "They did not show up"; hunter "The landlord did not show up". Three missed viewings in 90 days pause new requests.

## 8. Email

Needs `RESEND_API_KEY` (and a verified domain for `EMAIL_FROM` to reach everyone).

1. Sign up: a "Confirm your email" email arrives; until you open the link, requesting a viewing is refused and a banner shows "Send it again".
2. Request, accept, move, decline: the landlord and visitor are emailed (no phone or email in the text).
3. Reminders run once a day at 07:00 for viewings booked for tomorrow.
4. Without the key nothing is sent and nobody is asked to confirm.

## 9. Reviews

1. A hunter can review only after the landlord marks their viewing "Mark complete" (or after renting).
2. Listing page: stars, "matched the photos", "price as stated", comment. One review per person per place.
3. Landlord: property page, "Reviews", "Reply". Everyone sees the reply. Landlords cannot delete.
4. Admin: **Reports**, "Reviews on this listing", "Remove" for abusive ones.

## 10. Reports

1. Any signed-in person: "Report this listing" at the bottom of a listing. One open report each.
2. Three different accounts at least a day old (five if the landlord is verified) pause the listing automatically and email the landlord. Brand-new accounts do not count.
3. Admin: **Reports** tab. "Take down" (with a note the landlord sees) or "Dismiss" (restores a listing that was only paused automatically).

## 11. Phone, menus and install

1. Resize the browser narrow (or open on a phone): header becomes a hamburger menu; landlord, tenant and admin get a bottom tab bar.
2. On a phone, "Install" adds DirectLet to the home screen (needs the live https site).

## 12. Admin panel

Overview (visitors, sign-ups, listings, verification, reported listings, rent), Users (search, suspend), Properties (take down), Verify, Reports, Activity (who did what).

## Automated tests

Each script creates its own accounts, so restart the API between runs (sign-ups are limited to 10 an hour).

```powershell
$env:API_BASE = "http://localhost:4100"
.\scripts\test-verification.ps1   # verification, fees, freshness
.\scripts\test-photos.ps1         # photos
.\scripts\test-viewings.ps1       # viewing requests
```

`test-trust.ps1` (email, reviews, reports) and `test-captcha.ps1` need extra setup; the top of each file explains it.
Run them against your laptop, never the live site. They leave `vtest.*@example.com` accounts behind.

## On the live site (after you push and redeploy)

1. `/api/health` answers `ok`; `/api/auth/config` shows your site key.
2. Sign up as a landlord, add a property with photos and fees, submit "Get verified".
3. As admin, approve it; the badge shows on the listing.
4. Sign up as a hunter, request a viewing; accept it as the landlord; "Mark complete"; leave a review.
5. Report a listing from a second account and check the admin Reports tab.
