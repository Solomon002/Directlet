# Tests Phase 2 safer viewing requests: sign-in required, per-person limits, private
# contact details until the landlord accepts, reschedule, cancel, no-shows both ways,
# the restriction for repeat no-shows, and the rent-change notice.
# Creates its own accounts with random passwords; nothing is stored in the repo.
$apiBase = if ($env:API_BASE) { $env:API_BASE } else { "http://localhost:4000" }
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

function Login($email) {
  $r = Invoke-RestMethod -Uri "$apiBase/auth/login" -Method Post -ContentType $json -Body (@{ email = $email; password = $testPassword } | ConvertTo-Json)
  return @{ Authorization = "Bearer $($r.accessToken)" }
}

function Post($path, $headers, $body) {
  return Invoke-RestMethod -Uri "$apiBase$path" -Method Post -Headers $headers -ContentType $json -Body ($body | ConvertTo-Json)
}

function Api-Get($path, $headers) { return Invoke-RestMethod -Uri "$apiBase$path" -Headers $headers }

function Request-Viewing($unitId, $headers, $extra = @{}) {
  return (Post "/public/units/$unitId/inspection-requests" $headers (@{ phone = "08011112222" } + $extra)).inspectionRequest
}

function Backdate($viewingId, $days) {
  pnpm --silent --dir "$repoRoot/apps/api" exec tsx ../../scripts/test-helper-backdate-viewing.ts $viewingId $days | Out-Null
}

$suffix = Get-Random
$today = (Get-Date).ToString("yyyy-MM-dd")
$tomorrow = (Get-Date).AddDays(1).ToString("yyyy-MM-dd")
$nextWeek = (Get-Date).AddDays(7).ToString("yyyy-MM-dd")
$yesterday = (Get-Date).AddDays(-1).ToString("yyyy-MM-dd")

foreach ($n in "l", "l2") { Register "Vtest Landlord $n" "vtest.v$n.$suffix@example.com" "LANDLORD" | Out-Null }
foreach ($n in "h1", "h2", "h3") { Register "Vtest Hunter $n" "vtest.v$n.$suffix@example.com" "HUNTER" | Out-Null }
$l = Login "vtest.vl.$suffix@example.com"; $l2 = Login "vtest.vl2.$suffix@example.com"
$h1 = Login "vtest.vh1.$suffix@example.com"; $h2 = Login "vtest.vh2.$suffix@example.com"; $h3 = Login "vtest.vh3.$suffix@example.com"

$prop = (Post "/properties" $l @{ name = "Vtest Viewing House $suffix"; address = "1 Test Street"; area = "Yaba"; city = "Lagos"; state = "Lagos" }).property
$units = foreach ($n in 1..8) { (Post "/properties/$($prop.id)/units" $l @{ label = "Flat $n"; bedrooms = 2; rentAmount = 1000000 }).unit }

# --- Who may ask ---
Expect-Status "Signed-out visitors cannot request a viewing" 401 { Invoke-RestMethod -Uri "$apiBase/public/units/$($units[0].id)/inspection-requests" -Method Post -ContentType $json -Body (@{ phone = "08011112222" } | ConvertTo-Json) }
Expect-Status "A landlord cannot request a viewing" 403 { Request-Viewing $units[0].id $l }
Expect-Status "A phone number is required" 400 { Post "/public/units/$($units[0].id)/inspection-requests" $h1 @{ message = "hi" } }
Expect-Status "A past preferred date is refused" 400 { Request-Viewing $units[0].id $h1 @{ preferredDate = $yesterday } }

# --- Asking, and the limits ---
$r1 = Request-Viewing $units[0].id $h1 @{ message = "Weekend works"; preferredDate = $nextWeek }
Check "A signed-in house hunter can ask" ($r1.status -eq "PENDING") ""
Check "The reply does not echo contact details back" ($null -eq $r1.phone -and $null -eq $r1.email) ""
Expect-Status "Asking twice for the same flat is refused" 409 { Request-Viewing $units[0].id $h1 }
$open = @($r1)
foreach ($n in 1..4) { $open += Request-Viewing $units[$n].id $h1 }
Check "A person can have 5 open requests" ($open.Count -eq 5) ""
Expect-Status "A 6th open request is refused" 409 { Request-Viewing $units[5].id $h1 }

# --- The landlord's view: contact stays private until accepted ---
$row = @((Api-Get "/inspections" $l).inspectionRequests | Where-Object { $_.id -eq $r1.id })[0]
Check "The landlord sees the visitor's name" ($row.name -eq "Vtest Hunter h1") "(got $($row.name))"
Check "Phone and email are hidden while it is pending" ($null -eq $row.phone -and $null -eq $row.email -and $row.contactHidden -eq $true) "(phone=$($row.phone))"
Check "A new visitor shows a clean record" ($row.visitorRecord.attended -eq 0 -and $row.visitorRecord.missed -eq 0) ""
Expect-Status "Another landlord cannot see or act on it" 404 { Post "/inspections/$($r1.id)/schedule" $l2 @{ scheduledFor = $tomorrow } }
Expect-Status "A viewing cannot be marked complete before it is scheduled" 409 { Post "/inspections/$($r1.id)/complete" $l @{} }
Expect-Status "A date in the past is refused" 400 { Post "/inspections/$($r1.id)/schedule" $l @{ scheduledFor = $yesterday } }

Post "/inspections/$($r1.id)/schedule" $l @{ scheduledFor = $tomorrow } | Out-Null
$row = @((Api-Get "/inspections" $l).inspectionRequests | Where-Object { $_.id -eq $r1.id })[0]
Check "Accepting reveals the visitor's phone and email" ($row.phone -eq "08011112222" -and $row.email -eq "vtest.vh1.$suffix@example.com" -and $row.contactHidden -eq $false) "(phone=$($row.phone))"

# --- Reschedule ---
Post "/inspections/$($r1.id)/schedule" $l @{ scheduledFor = $nextWeek } | Out-Null
$mine = @((Api-Get "/viewings" $h1).viewings | Where-Object { $_.id -eq $r1.id })[0]
Check "Moving the date is counted and shown to the visitor" ($mine.rescheduleCount -eq 1 -and $mine.status -eq "SCHEDULED") "(got $($mine.rescheduleCount))"

# --- The visitor's own list ---
Check "The visitor sees only their own requests" (@((Api-Get "/viewings" $h1).viewings).Count -eq 5 -and @((Api-Get "/viewings" $h2).viewings).Count -eq 0) ""
Check "The visitor's list carries no landlord contact details" (-not ($mine.PSObject.Properties.Name -contains "phone") -and -not ($mine.PSObject.Properties.Name -contains "email")) ""
Expect-Status "Another visitor cannot cancel it" 404 { Post "/viewings/$($r1.id)/cancel" $h2 @{} }
Expect-Status "A landlord cannot use the visitor's list" 403 { Api-Get "/viewings" $l }
Expect-Status "Signed-out visitors have no list" 401 { Invoke-RestMethod -Uri "$apiBase/viewings" }

# --- Rent change notice ---
Check "No rent notice while the rent is unchanged" ($null -eq $mine.rent.askedAt) ""
Invoke-RestMethod -Uri "$apiBase/properties/$($prop.id)/units/$($units[0].id)" -Method Patch -Headers $l -ContentType $json -Body (@{ rentAmount = 1200000 } | ConvertTo-Json) | Out-Null
$mine = @((Api-Get "/viewings" $h1).viewings | Where-Object { $_.id -eq $r1.id })[0]
Check "A rent change after asking is pointed out, with the old figure" ($mine.rent.askedAt.amount -eq "1000000.00" -and $mine.rent.current.amount -eq "1200000.00") "(got $($mine.rent.askedAt.amount) -> $($mine.rent.current.amount))"

# --- Cancel, and asking again ---
$r2 = $open[1]
Post "/viewings/$($r2.id)/cancel" $h1 @{} | Out-Null
$cancelled = @((Api-Get "/viewings" $h1).viewings | Where-Object { $_.id -eq $r2.id })[0]
Check "The visitor can cancel" ($cancelled.status -eq "CANCELLED") ""
Expect-Status "A cancelled request cannot be cancelled again" 409 { Post "/viewings/$($r2.id)/cancel" $h1 @{} }
$rowCancelled = @((Api-Get "/inspections" $l).inspectionRequests | Where-Object { $_.id -eq $r2.id })[0]
Check "The landlord sees it as cancelled, contact still private" ($rowCancelled.status -eq "CANCELLED" -and $null -eq $rowCancelled.phone) ""
$again = Request-Viewing $units[1].id $h1
Check "After cancelling, the same flat can be asked about again" ($again.status -eq "PENDING") ""

# --- Declining ---
$d = Request-Viewing $units[0].id $h2
Post "/inspections/$($d.id)/decline" $l @{ landlordNote = "Taken" } | Out-Null
Expect-Status "A declined request cannot be scheduled" 409 { Post "/inspections/$($d.id)/schedule" $l @{ scheduledFor = $tomorrow } }

# --- Visitor did not show up ---
$n1 = Request-Viewing $units[6].id $h2
Post "/inspections/$($n1.id)/schedule" $l @{ scheduledFor = $today } | Out-Null
Expect-Status "No-show cannot be called before the day has passed" 409 { Post "/inspections/$($n1.id)/no-show" $l @{} }
Backdate $n1.id 3
Post "/inspections/$($n1.id)/no-show" $l @{} | Out-Null
$row = @((Api-Get "/inspections" $l).inspectionRequests | Where-Object { $_.id -eq $n1.id })[0]
Check "After the day, the landlord can mark the visitor as a no-show" ($row.status -eq "NO_SHOW_VISITOR") "(got $($row.status))"
Expect-Status "A missed viewing cannot become a tenancy" 409 { Post "/inspections/$($n1.id)/convert" $l @{ tenantEmail = "x@example.com"; tenantFullName = "X Y"; startDate = $today } }

# --- Landlord did not show up ---
$n2 = Request-Viewing $units[7].id $h2
Post "/inspections/$($n2.id)/schedule" $l @{ scheduledFor = $today } | Out-Null
Expect-Status "The visitor cannot report a no-show before the day has passed" 409 { Post "/viewings/$($n2.id)/report-no-show" $h2 @{} }
Backdate $n2.id 3
Expect-Status "Another visitor cannot report on someone else's viewing" 404 { Post "/viewings/$($n2.id)/report-no-show" $h1 @{} }
Post "/viewings/$($n2.id)/report-no-show" $h2 @{} | Out-Null
$rep = @((Api-Get "/viewings" $h2).viewings | Where-Object { $_.id -eq $n2.id })[0]
Check "After the day, the visitor can report the landlord did not show" ($rep.status -eq "NO_SHOW_LANDLORD") "(got $($rep.status))"

# --- Repeat no-shows are held back ---
$restricted = $false
foreach ($n in 0..2) {
  $x = Request-Viewing $units[$n + 2].id $h3
  Post "/inspections/$($x.id)/schedule" $l @{ scheduledFor = $today } | Out-Null
  Backdate $x.id 3
  Post "/inspections/$($x.id)/no-show" $l @{} | Out-Null
}
$visitorRow = @((Api-Get "/inspections" $l).inspectionRequests | Where-Object { $_.status -eq "NO_SHOW_VISITOR" } | Where-Object { $_.visitorRecord.missed -ge 3 })[0]
Check "The landlord can see a visitor's missed count" ($null -ne $visitorRow -and $visitorRow.visitorRecord.missed -eq 3) ""
Expect-Status "Three missed viewings pause new requests" 403 { Request-Viewing $units[5].id $h3 }

Write-Host ""
Write-Host "Test accounts: vtest.v*.$suffix@example.com (left in the database; remove with the cleanup step)."
