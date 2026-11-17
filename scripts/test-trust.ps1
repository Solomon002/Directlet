# Tests Phase 3 and email: confirming an email address, notification and reminder emails,
# reviews (who may write one, the landlord's reply, removal), and reports (including the
# automatic pause after several reports and the admin's decision).
#
# Needs the API running with a fake mail server, so nothing real is sent:
#   1. node scripts/fake-mail-server.mjs              (with MAIL_LOG set to a file path)
#   2. start the API with RESEND_API_KEY=test-key-0123456789
#        RESEND_API_URL=http://localhost:4199/emails  CRON_SECRET=test-cron-secret-0123456789
#   3. set API_BASE, MAIL_LOG and CRON_SECRET to the same values, then run this script.
# Creates its own accounts with random passwords; nothing is stored in the repo.
$apiBase = if ($env:API_BASE) { $env:API_BASE } else { "http://localhost:4000" }
if (-not $env:MAIL_LOG) { throw "Set MAIL_LOG to the file the fake mail server writes to." }
if (-not $env:CRON_SECRET) { throw "Set CRON_SECRET to the value the API was started with." }
$testPassword = "Tp-" + [guid]::NewGuid().ToString("N")
$repoRoot = Split-Path -Parent $PSScriptRoot
$json = "application/json"

function Expect-Status($label, $expected, [scriptblock]$call) {
  try {
    & $call | Out-Null
    Write-Host "FAIL  $label (expected $expected, got success)" -ForegroundColor Red
  } catch {
    $code = [int]$_.Exception.Response.StatusCode
    if ($code -eq $expected) { Write-Host "PASS  $label ($code)" -ForegroundColor Green }
    else { Write-Host "FAIL  $label (expected $expected, got $code) $($_.ErrorDetails.Message)" -ForegroundColor Red }
  }
}

function Check($label, $condition, $detail) {
  if ($condition) { Write-Host "PASS  $label" -ForegroundColor Green } else { Write-Host "FAIL  $label $detail" -ForegroundColor Red }
}

function Register($name, $email, $type) {
  return Invoke-RestMethod -Uri "$apiBase/auth/register" -Method Post -ContentType $json -Body (@{ fullName = $name; email = $email; password = $testPassword; accountType = $type } | ConvertTo-Json)
}

function Login-Raw($email) {
  return Invoke-RestMethod -Uri "$apiBase/auth/login" -Method Post -ContentType $json -Body (@{ email = $email; password = $testPassword } | ConvertTo-Json)
}

function Login($email) { return @{ Authorization = "Bearer $((Login-Raw $email).accessToken)" } }

function Post($path, $headers, $body) {
  return Invoke-RestMethod -Uri "$apiBase$path" -Method Post -Headers $headers -ContentType $json -Body ($body | ConvertTo-Json)
}

function Api-Get($path, $headers) { return Invoke-RestMethod -Uri "$apiBase$path" -Headers $headers }

function Db($command, $a, $b) {
  pnpm --silent --dir "$repoRoot/apps/api" exec tsx ../../scripts/test-helper-db.ts $command $a $b | Out-Null
}

# Waits for the fake mail server to have written a matching email.
function Wait-Mail($to, $subjectLike) {
  foreach ($try in 1..30) {
    $lines = @(Get-Content $env:MAIL_LOG -ErrorAction SilentlyContinue | Where-Object { $_ })
    $found = $lines | ForEach-Object { $_ | ConvertFrom-Json } | Where-Object { $_.to -eq $to -and $_.subject -like $subjectLike } | Select-Object -Last 1
    if ($found) { return $found }
    Start-Sleep -Milliseconds 300
  }
  return $null
}

function Mail-Token($mail) { if ($mail.text -match "verify-email\?token=([A-Za-z0-9_-]+)") { return $Matches[1] } else { return $null } }

$suffix = Get-Random
$tomorrow = (Get-Date).AddDays(1).ToString("yyyy-MM-dd")
function Email($n) { return "vtest.t$n.$suffix@example.com" }

# --- Accounts ---
Register "Vtest Admin" (Email "admin") "HUNTER" | Out-Null
pnpm --silent --dir "$repoRoot" --filter @directlet/api admin:grant (Email "admin") | Out-Null
$admin = Login (Email "admin")
Register "Vtest Landlord" (Email "land") "LANDLORD" | Out-Null
Register "Vtest Landlord Two" (Email "land2") "LANDLORD" | Out-Null
$land = Login (Email "land"); $land2 = Login (Email "land2")
$prop = (Post "/properties" $land @{ name = "Vtest Trust House $suffix"; address = "1 Test Street"; area = "Yaba"; city = "Lagos"; state = "Lagos" }).property
$unit = (Post "/properties/$($prop.id)/units" $land @{ label = "Flat 1"; bedrooms = 2; rentAmount = 900000 }).unit

# --- Confirming an email address ---
$reg = Register "Vtest Hunter h1" (Email "h1") "HUNTER"
$h1 = @{ Authorization = "Bearer $($reg.accessToken)" }
Check "Sign-up reports the address as not yet confirmed" ($reg.user.emailVerified -eq $false) ""
$mail = Wait-Mail (Email "h1") "Confirm your email*"
Check "A confirmation email is sent at sign-up" ($null -ne $mail) ""
$token = Mail-Token $mail
Check "The email carries a link with a token" ($null -ne $token -and $token.Length -ge 20) ""
Expect-Status "A viewing cannot be requested before confirming" 403 { Post "/public/units/$($unit.id)/inspection-requests" $h1 @{ phone = "08011112222" } }
Expect-Status "A new link cannot be asked for within a minute" 429 { Post "/email/resend" $h1 @{} }
Expect-Status "A made-up token is refused" 400 { Post "/email/verify" @{} @{ token = ("x" * 43) } }

Register "Vtest Hunter r3" (Email "r3") "HUNTER" | Out-Null
$mail3 = Wait-Mail (Email "r3") "Confirm your email*"
Db "expire-email-token" (Email "r3")
Expect-Status "An expired link is refused" 400 { Post "/email/verify" @{} @{ token = (Mail-Token $mail3) } }

Post "/email/verify" @{} @{ token = $token } | Out-Null
Check "Opening the link confirms the address" ((Login-Raw (Email "h1")).user.emailVerified -eq $true) ""
Expect-Status "A used link cannot be used again" 400 { Post "/email/verify" @{} @{ token = $token } }
Check "A confirmed user is told so when asking again" ((Post "/email/resend" $h1 @{}).alreadyVerified -eq $true) ""

# --- Notification and reminder emails ---
$viewing = (Post "/public/units/$($unit.id)/inspection-requests" $h1 @{ phone = "08011112222"; message = "Hello" }).inspectionRequest
Check "A confirmed user can request a viewing" ($viewing.status -eq "PENDING") ""
$toLandlord = Wait-Mail (Email "land") "New viewing request*"
Check "The landlord is emailed about the request" ($null -ne $toLandlord) ""
Check "That email does not reveal the visitor's phone or email" ($toLandlord.text -notmatch "08011112222" -and $toLandlord.text -notmatch "vtest.th1") ""

Post "/inspections/$($viewing.id)/schedule" $land @{ scheduledFor = $tomorrow } | Out-Null
$answer = Wait-Mail (Email "h1") "Your viewing day*"
Check "The visitor is emailed when the landlord accepts" ($null -ne $answer -and $answer.text -match "confirmed for") ""

Expect-Status "The reminder job refuses a wrong secret" 404 { Invoke-RestMethod -Uri "$apiBase/jobs/viewing-reminders" -Headers @{ Authorization = "Bearer wrong" } }
$run = Invoke-RestMethod -Uri "$apiBase/jobs/viewing-reminders" -Headers @{ Authorization = "Bearer $($env:CRON_SECRET)" }
Check "The reminder job reminds for a viewing tomorrow" ($run.reminded -ge 1) "(reminded $($run.reminded))"
Check "The visitor gets a reminder" ($null -ne (Wait-Mail (Email "h1") "Reminder: viewing tomorrow*")) ""
Check "The landlord gets a reminder" ($null -ne (Wait-Mail (Email "land") "Reminder: viewing tomorrow*")) ""
$again = Invoke-RestMethod -Uri "$apiBase/jobs/viewing-reminders" -Headers @{ Authorization = "Bearer $($env:CRON_SECRET)" }
Check "Running it again does not send a second reminder" ($again.reminded -eq 0) "(reminded $($again.reminded))"

# --- Reviews ---
$elig = Api-Get "/public/properties/$($prop.id)/review-eligibility" $h1
Check "A visitor whose viewing has not happened cannot review yet" ($elig.eligible -eq $false) ""
Expect-Status "Reviewing before a completed viewing is refused" 403 { Post "/public/properties/$($prop.id)/reviews" $h1 @{ rating = 5; matchedPhotos = $true; priceAsStated = $true } }

Post "/inspections/$($viewing.id)/complete" $land @{} | Out-Null
Check "After the landlord marks the viewing done, they can review" ((Api-Get "/public/properties/$($prop.id)/review-eligibility" $h1).eligible -eq $true) ""
Expect-Status "A rating of 6 is refused" 400 { Post "/public/properties/$($prop.id)/reviews" $h1 @{ rating = 6; matchedPhotos = $true; priceAsStated = $true } }
Expect-Status "A landlord cannot post a review" 403 { Post "/public/properties/$($prop.id)/reviews" $land @{ rating = 5; matchedPhotos = $true; priceAsStated = $true } }
Expect-Status "Signed-out visitors cannot review" 401 { Invoke-RestMethod -Uri "$apiBase/public/properties/$($prop.id)/reviews" -Method Post -ContentType $json -Body (@{ rating = 5; matchedPhotos = $true; priceAsStated = $true } | ConvertTo-Json) }
$review = (Post "/public/properties/$($prop.id)/reviews" $h1 @{ rating = 4; matchedPhotos = $true; priceAsStated = $false; comment = "Clean and as pictured. Rent was higher than listed." }).review
Check "A visitor who attended can review" ($null -ne $review.id) ""
Expect-Status "A second review of the same place is refused" 403 { Post "/public/properties/$($prop.id)/reviews" $h1 @{ rating = 1; matchedPhotos = $false; priceAsStated = $false } }

$pub = (Api-Get "/public/properties/$($prop.id)" @{}).property
Check "The listing shows the count and average" ($pub.reviews.count -eq 1 -and $pub.reviews.average -eq 4) "(got $($pub.reviews.count), $($pub.reviews.average))"
Check "It shows how often the place matched its photos and price" ($pub.reviews.matchedPhotosPercent -eq 100 -and $pub.reviews.priceAsStatedPercent -eq 0) ""
Check "The reviewer is shown as first name and initial only" ($pub.reviews.items[0].reviewerName -eq "Vtest H.") "(got $($pub.reviews.items[0].reviewerName))"
$card = (Api-Get "/public/properties?pageSize=50" @{}).properties | Where-Object { $_.id -eq $prop.id }
Check "The marketplace card carries the rating" ($card.rating.average -eq 4 -and $card.rating.count -eq 1) ""

Check "The landlord sees the review" (@((Api-Get "/properties/$($prop.id)/reviews" $land).reviews).Count -eq 1) ""
Expect-Status "Another landlord cannot see or answer it" 404 { Post "/properties/$($prop.id)/reviews/$($review.id)/response" $land2 @{ response = "Not mine" } }
Post "/properties/$($prop.id)/reviews/$($review.id)/response" $land @{ response = "Thank you. The rent on the listing has been corrected." } | Out-Null
$pub = (Api-Get "/public/properties/$($prop.id)" @{}).property
Check "The landlord's reply shows under the review" ($pub.reviews.items[0].landlordResponse -like "Thank you*") ""
Expect-Status "A landlord cannot remove a review" 404 { Invoke-RestMethod -Uri "$apiBase/properties/$($prop.id)/reviews/$($review.id)" -Method Delete -Headers $land }
Expect-Status "A non-admin cannot remove a review" 403 { Post "/admin/reviews/$($review.id)/remove" $h1 @{} }
Post "/admin/reviews/$($review.id)/remove" $admin @{} | Out-Null
Check "An admin can remove a review, and it leaves the listing" ((Api-Get "/public/properties/$($prop.id)" @{}).property.reviews.count -eq 0) ""

# --- Reports ---
foreach ($n in "r1", "r2", "r4") { Register "Vtest Reporter $n" (Email $n) "HUNTER" | Out-Null }
$r1 = Login (Email "r1"); $r2 = Login (Email "r2"); $r3 = Login (Email "r3"); $r4 = Login (Email "r4")
Expect-Status "Signed-out visitors cannot report" 401 { Invoke-RestMethod -Uri "$apiBase/reports" -Method Post -ContentType $json -Body (@{ propertyId = $prop.id; reason = "FAKE_LISTING" } | ConvertTo-Json) }
Expect-Status "A landlord cannot report their own listing" 400 { Post "/reports" $land @{ propertyId = $prop.id; reason = "FAKE_LISTING" } }
Expect-Status "An unknown reason is refused" 400 { Post "/reports" $r1 @{ propertyId = $prop.id; reason = "I_DISLIKE_IT" } }
Expect-Status "A report on a listing that does not exist is a 404" 404 { Post "/reports" $r1 @{ propertyId = [guid]::NewGuid().ToString(); reason = "FAKE_LISTING" } }
$rep = (Post "/reports" $r1 @{ propertyId = $prop.id; reason = "ASKED_FOR_MONEY"; details = "Asked for a deposit before showing me the flat" }).report
Check "A signed-in person can report a listing" ($rep.status -eq "OPEN") ""
Expect-Status "The same person cannot report it twice" 409 { Post "/reports" $r1 @{ propertyId = $prop.id; reason = "FAKE_LISTING" } }
Post "/reports" $r2 @{ propertyId = $prop.id; reason = "ASKED_FOR_MONEY" } | Out-Null
Post "/reports" $r3 @{ propertyId = $prop.id; reason = "STOLEN_PHOTOS" } | Out-Null
Check "Three reports from brand-new accounts do not pause the listing" ((Invoke-WebRequest -Uri "$apiBase/public/properties/$($prop.id)" -UseBasicParsing).StatusCode -eq 200) ""

foreach ($n in "r1", "r2", "r3") { Db "age-user" (Email $n) 3 }
Post "/reports" $r4 @{ propertyId = $prop.id; reason = "FAKE_LISTING" } | Out-Null
Expect-Status "Three reports from established accounts pause the listing" 404 { Invoke-WebRequest -Uri "$apiBase/public/properties/$($prop.id)" -UseBasicParsing }
Check "The landlord is emailed that it is paused" ($null -ne (Wait-Mail (Email "land") "Your listing*is paused*")) ""

Expect-Status "A non-admin cannot see reports" 403 { Api-Get "/admin/reports" $r1 }
$queue = Api-Get "/admin/reports" $admin
$group = $queue.groups | Where-Object { $_.property.id -eq $prop.id }
Check "The admin queue groups reports by listing" ($group.count -eq 4 -and $group.property.hiddenByAdminAt) "(count $($group.count))"
Check "It shows why people reported" (@($group.reports | Where-Object { $_.reason -eq "ASKED_FOR_MONEY" }).Count -eq 2) ""

Expect-Status "A non-admin cannot decide a report" 403 { Post "/admin/reports/property/$($prop.id)/resolve" $r1 @{ action = "DISMISS" } }
Post "/admin/reports/property/$($prop.id)/resolve" $admin @{ action = "DISMISS"; note = "Checked: listing is accurate" } | Out-Null
Check "Dismissing the reports restores a listing that was only paused automatically" ((Invoke-WebRequest -Uri "$apiBase/public/properties/$($prop.id)" -UseBasicParsing).StatusCode -eq 200) ""
Check "The dismissed reports leave the open queue" (-not (@((Api-Get "/admin/reports" $admin).groups | Where-Object { $_.property.id -eq $prop.id }).Count)) ""
Expect-Status "There is nothing left to resolve" 409 { Post "/admin/reports/property/$($prop.id)/resolve" $admin @{ action = "DISMISS" } }

Post "/reports" $r1 @{ propertyId = $prop.id; reason = "ALREADY_LET" } | Out-Null
Post "/admin/reports/property/$($prop.id)/resolve" $admin @{ action = "TAKE_DOWN"; note = "Confirmed already let" } | Out-Null
Expect-Status "Taking the listing down hides it" 404 { Invoke-WebRequest -Uri "$apiBase/public/properties/$($prop.id)" -UseBasicParsing }
$mine = (Api-Get "/properties/$($prop.id)" $land).property
Check "The landlord sees the reason" ($mine.hiddenByAdminReason -eq "Confirmed already let") "(got $($mine.hiddenByAdminReason))"
$handled = Api-Get "/admin/reports?status=handled" $admin
Check "Handled reports are kept and can be looked up" (@($handled.groups | Where-Object { $_.property.id -eq $prop.id }).Count -eq 1) ""
Check "The admin overview counts reported listings" ($null -ne (Api-Get "/admin/overview" $admin).overview.reports.openListings) ""

Write-Host ""
Write-Host "Test accounts: vtest.t*.$suffix@example.com (left in the database; remove with the cleanup step)."
