# Tests Phase 1 trust features: landlord verification (individual and CAC company),
# document upload and review, price breakdown, and "still available" freshness.
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

# Smallest thing that passes the file-type check: the PNG signature, then padding.
$png = [byte[]]((0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A) + (1..64))

function Upload($headers, $kind, $bytes, $contentType) {
  return Invoke-RestMethod -Uri "$apiBase/verification/documents?kind=$kind&name=test-$kind.png" -Method Post -Headers $headers -ContentType $contentType -Body $bytes
}

function Backdate($unitId, $days) {
  pnpm --silent --dir "$repoRoot/apps/api" exec tsx ../../scripts/test-helper-backdate-unit.ts $unitId $days | Out-Null
}

$suffix = Get-Random
$cacNumber = "9" + (Get-Random -Minimum 100000 -Maximum 999999)

# --- Accounts ---
Register "Vtest Admin" "vtest.admin.$suffix@example.com" "HUNTER" | Out-Null
pnpm --silent --dir "$repoRoot" --filter @directlet/api admin:grant "vtest.admin.$suffix@example.com" | Out-Null
$admin = Login "vtest.admin.$suffix@example.com"
foreach ($n in "a", "b", "c") { Register "Vtest Landlord $n" "vtest.$n.$suffix@example.com" "LANDLORD" | Out-Null }
$a = Login "vtest.a.$suffix@example.com"
$b = Login "vtest.b.$suffix@example.com"
$c = Login "vtest.c.$suffix@example.com"
Register "Vtest Viewer" "vtest.viewer.$suffix@example.com" "HUNTER" | Out-Null
$viewer = Login "vtest.viewer.$suffix@example.com"

# --- Applying ---
Check "A new landlord starts unverified (no application)" ($null -eq (Invoke-RestMethod -Uri "$apiBase/verification" -Headers $a).verification) ""
Expect-Status "Signed-out visitors cannot apply" 401 { Invoke-RestMethod -Uri "$apiBase/verification" }
Expect-Status "A company must give its CAC details" 400 { Post "/verification" $a @{ landlordType = "COMPANY" } }
Expect-Status "A CAC number must be digits" 400 { Post "/verification" $a @{ landlordType = "COMPANY"; cacType = "RC"; cacNumber = "ABC"; registeredName = "X Ltd" } }
Expect-Status "Documents cannot be added before applying" 409 { Upload $a "ID" $png "image/png" }

$app = (Post "/verification" $a @{ landlordType = "INDIVIDUAL" }).verification
Check "An individual application is PENDING" ($app.status -eq "PENDING") "(got $($app.status))"
Check "It lists the documents still missing" (($app.missingDocuments -join ",") -eq "ID,OWNERSHIP") "(got $($app.missingDocuments -join ','))"

# --- Documents ---
Expect-Status "A file that only claims to be an image is refused" 415 { Upload $a "ID" ([System.Text.Encoding]::ASCII.GetBytes("not an image at all")) "image/png" }
Expect-Status "A text file is refused" 415 { Upload $a "ID" ([System.Text.Encoding]::ASCII.GetBytes("hello")) "text/plain" }
Expect-Status "An unknown document kind is refused" 400 { Upload $a "PASSPORT" $png "image/png" }
$id1 = (Upload $a "ID" $png "image/png").document
Check "An ID document is accepted" ($id1.kind -eq "ID" -and $id1.contentType -eq "image/png") ""

$adminDetail = (Invoke-RestMethod -Uri "$apiBase/admin/verifications/$($app.id)" -Headers $admin).verification
Expect-Status "Approving with documents missing is refused" 409 { Post "/admin/verifications/$($app.id)/approve" $admin @{} }
Upload $a "OWNERSHIP" $png "image/png" | Out-Null
Check "Once both documents are in, none are missing" (@((Invoke-RestMethod -Uri "$apiBase/verification" -Headers $a).verification.missingDocuments).Count -eq 0) ""

# --- Access ---
Expect-Status "A landlord cannot open the admin queue" 403 { Invoke-RestMethod -Uri "$apiBase/admin/verifications" -Headers $a }
Expect-Status "A landlord cannot approve themselves" 403 { Post "/admin/verifications/$($app.id)/approve" $a @{} }
Expect-Status "Another landlord cannot download my document" 404 { Invoke-RestMethod -Uri "$apiBase/verification/documents/$($id1.id)" -Headers $b }
$dl = Invoke-WebRequest -Uri "$apiBase/verification/documents/$($id1.id)" -Headers $a -UseBasicParsing
Check "The owner can download their document" ($dl.StatusCode -eq 200 -and $dl.Headers["Content-Type"] -eq "image/png") ""
Check "Downloads are never cached" ($dl.Headers["Cache-Control"] -match "no-store") ""
$dl2 = Invoke-WebRequest -Uri "$apiBase/verification/documents/$($id1.id)" -Headers $admin -UseBasicParsing
Check "An admin can download it too" ($dl2.StatusCode -eq 200) ""

# --- Review ---
$queue = Invoke-RestMethod -Uri "$apiBase/admin/verifications?status=PENDING" -Headers $admin
Check "The application is in the admin's pending queue" (@($queue.verifications | Where-Object { $_.id -eq $app.id }).Count -eq 1) ""
Expect-Status "Rejecting needs a reason" 400 { Post "/admin/verifications/$($app.id)/reject" $admin @{} }
Post "/admin/verifications/$($app.id)/approve" $admin @{} | Out-Null
$mine = (Invoke-RestMethod -Uri "$apiBase/verification" -Headers $a).verification
Check "Approval makes the landlord VERIFIED" ($mine.status -eq "VERIFIED" -and $mine.verifiedAt) "(got $($mine.status))"
Expect-Status "A verified landlord cannot re-apply or add files" 409 { Post "/verification" $a @{ landlordType = "INDIVIDUAL" } }
Expect-Status "A verified landlord cannot add files" 409 { Upload $a "ID" $png "image/png" }
Check "The admin overview counts verifications" ((Invoke-RestMethod -Uri "$apiBase/admin/overview" -Headers $admin).overview.verifications.VERIFIED -ge 1) ""

# --- CAC company ---
$co = (Post "/verification" $b @{ landlordType = "COMPANY"; cacType = "RC"; cacNumber = "RC $cacNumber"; registeredName = "Vtest Homes Ltd" }).verification
Check "A CAC number typed as 'RC 123' is stored as digits only" ($co.cacNumber -eq $cacNumber -and $co.cacType -eq "RC") "(got $($co.cacType) $($co.cacNumber))"
Check "A company also needs its CAC certificate" (($co.missingDocuments -join ",") -eq "ID,OWNERSHIP,CAC_CERTIFICATE") "(got $($co.missingDocuments -join ','))"
Expect-Status "The same CAC number cannot back a second account" 409 { Post "/verification" $c @{ landlordType = "COMPANY"; cacType = "RC"; cacNumber = $cacNumber; registeredName = "Copycat Ltd" } }
foreach ($kind in "ID", "OWNERSHIP", "CAC_CERTIFICATE") { Upload $b $kind $png "image/png" | Out-Null }
Post "/admin/verifications/$($co.id)/reject" $admin @{ reason = "Name does not match CAC" } | Out-Null
$rej = (Invoke-RestMethod -Uri "$apiBase/verification" -Headers $b).verification
Check "Rejection is shown with its reason" ($rej.status -eq "REJECTED" -and $rej.rejectionReason -eq "Name does not match CAC") ""
$again = (Post "/verification" $b @{ landlordType = "COMPANY"; cacType = "RC"; cacNumber = $cacNumber; registeredName = "Vtest Homes Limited" }).verification
Check "Sending it again after a rejection puts it back in the queue" ($again.status -eq "PENDING" -and -not $again.rejectionReason) ""
Post "/admin/verifications/$($co.id)/approve" $admin @{} | Out-Null

# --- Price breakdown on the public page ---
$prop = (Post "/properties" $a @{ name = "Vtest Court $suffix"; address = "1 Test Street"; area = "Yaba"; city = "Lagos"; state = "Lagos" }).property
$unit = (Post "/properties/$($prop.id)/units" $a @{ label = "Flat 1"; bedrooms = 2; rentAmount = 1000000; rentFrequency = "ANNUAL"; cautionDeposit = 200000; agreementFee = 100000; agencyFee = 0 }).unit
Expect-Status "A negative fee is refused" 400 { Post "/properties/$($prop.id)/units" $a @{ label = "Flat 2"; bedrooms = 1; rentAmount = 500000; cautionDeposit = -5 } }

$pub = (Invoke-RestMethod -Uri "$apiBase/public/properties/$($prop.id)").property
$pu = $pub.units[0]
Check "Total to move in = rent + the fees the landlord stated" ($pu.moveInTotal -eq "1300000.00") "(got $($pu.moveInTotal))"
Check "Unstated fees are listed, not treated as zero" (($pu.unstatedFees -join ",") -eq "Service charge") "(got $($pu.unstatedFees -join ','))"
Check "A fee of 0 is shown as 0, not as 'ask'" ((@($pu.fees | Where-Object { $_.key -eq "agencyFee" })[0].amount) -eq "0.00") ""
Check "A verified individual shows as verified, with no CAC details" ($pub.landlord.verified -eq $true -and $pub.landlord.landlordType -eq "INDIVIDUAL" -and -not $pub.landlord.cacNumber) ""

$prop2 = (Post "/properties" $b @{ name = "Vtest Towers $suffix"; address = "2 Test Street"; area = "Yaba"; city = "Lagos"; state = "Lagos" }).property
Post "/properties/$($prop2.id)/units" $b @{ label = "Flat 1"; bedrooms = 3; rentAmount = 2000000 } | Out-Null
$pub2 = (Invoke-RestMethod -Uri "$apiBase/public/properties/$($prop2.id)").property
Check "A verified company shows its CAC type, number and name" ($pub2.landlord.cacType -eq "RC" -and $pub2.landlord.cacNumber -eq $cacNumber -and $pub2.landlord.registeredName -eq "Vtest Homes Limited") "(got $($pub2.landlord | ConvertTo-Json -Compress))"

$prop3 = (Post "/properties" $c @{ name = "Vtest Plaza $suffix"; address = "3 Test Street"; area = "Yaba"; city = "Lagos"; state = "Lagos" }).property
Check "An unverified landlord's listing is marked unverified" ((Invoke-RestMethod -Uri "$apiBase/public/properties/$($prop3.id)").property.landlord.verified -eq $false) ""

$list = (Invoke-RestMethod -Uri "$apiBase/public/properties?pageSize=50").properties
$seenUnverified = $false; $order = $true
foreach ($p in $list) { if (-not $p.landlord.verified) { $seenUnverified = $true } elseif ($seenUnverified) { $order = $false } }
Check "Verified landlords are listed before unverified ones" $order ""

# --- Freshness ---
Check "A fresh flat is available" ($pu.availability -eq "AVAILABLE" -and $pu.isVacant -eq $true) ""
Backdate $unit.id 20
$mineP = (Invoke-RestMethod -Uri "$apiBase/properties/$($prop.id)" -Headers $a).property
Check "After 14 days the landlord is asked to confirm" ($mineP.units[0].availability.state -eq "DUE") "(got $($mineP.units[0].availability.state))"
$myList = (Invoke-RestMethod -Uri "$apiBase/properties" -Headers $a).properties | Where-Object { $_.id -eq $prop.id }
Check "The property list counts flats needing confirmation" ($myList.needsConfirmation -eq 1) "(got $($myList.needsConfirmation))"
Check "Visitors still see it at that point" ((Invoke-RestMethod -Uri "$apiBase/public/properties/$($prop.id)").property.units[0].availability -eq "AVAILABLE") ""

Backdate $unit.id 40
$stale = (Invoke-RestMethod -Uri "$apiBase/public/properties/$($prop.id)").property.units[0]
Check "After 30 days it is marked unconfirmed for visitors" ($stale.availability -eq "UNCONFIRMED" -and $stale.isVacant -eq $false) "(got $($stale.availability))"
Expect-Status "A viewing cannot be requested for an unconfirmed flat" 409 { Post "/public/units/$($unit.id)/inspection-requests" $viewer @{ phone = "08000000000" } }

Expect-Status "Another landlord cannot confirm my flat" 404 { Post "/properties/$($prop.id)/units/$($unit.id)/confirm" $b @{} }
Post "/properties/$($prop.id)/units/$($unit.id)/confirm" $a @{} | Out-Null
$fresh = (Invoke-RestMethod -Uri "$apiBase/public/properties/$($prop.id)").property.units[0]
Check "'Still available' makes it available again" ($fresh.availability -eq "AVAILABLE") "(got $($fresh.availability))"
$req = Post "/public/units/$($unit.id)/inspection-requests" $viewer @{ phone = "08000000000" }
Check "A viewing can be requested again" ($null -ne $req) ""

Backdate $unit.id 40
$all = Post "/properties/$($prop.id)/units/confirm-all" $a @{}
Check "Confirm-all refreshes every flat on the property" ($all.confirmed -eq 1) "(got $($all.confirmed))"

Write-Host ""
Write-Host "Test accounts: vtest.*.$suffix@example.com (left in the database; remove with the cleanup step)."
