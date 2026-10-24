# Tests the admin panel API: granting admin, overview numbers, visit counting,
# user search, suspension, and taking listings down. Creates its own accounts.
$apiBase = "http://localhost:4000"
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
  return Invoke-RestMethod -Uri "$apiBase/auth/register" -Method Post -ContentType $json -Body (@{ fullName = $name; email = $email; password = "AdminTestPass123!"; accountType = $type } | ConvertTo-Json)
}

function Login($email) {
  return Invoke-RestMethod -Uri "$apiBase/auth/login" -Method Post -ContentType $json -Body (@{ email = $email; password = "AdminTestPass123!" } | ConvertTo-Json)
}

$suffix = Get-Random

# --- Granting admin ---
$adminEmail = "admin.$suffix@example.com"
Register "Test Admin" $adminEmail "HUNTER" | Out-Null
$grant = pnpm --silent --dir "$repoRoot" --filter @directlet/api admin:grant $adminEmail 2>&1 | Out-String
Check "admin:grant makes the account an admin" ($grant -match "is now an admin") "($grant)"
$admin = Login $adminEmail
Check "Admin logs in with the ADMIN role" ($admin.user.role -eq "ADMIN") "(got $($admin.user.role))"
$ah = @{ Authorization = "Bearer $($admin.accessToken)" }
Write-Host "      Admin login: $adminEmail / AdminTestPass123!"

$refused = pnpm --silent --dir "$repoRoot" --filter @directlet/api admin:grant "demo@directlet.ng" 2>&1 | Out-String
Check "admin:grant refuses to turn a landlord into an admin" ($refused -match "landlord account") "($refused)"

Expect-Status "Sign-up cannot create an admin" 400 { Register "Sneaky" "sneaky.$suffix@example.com" "ADMIN" }

# --- Who can open the panel ---
$demo = Invoke-RestMethod -Uri "$apiBase/auth/login" -Method Post -ContentType $json -Body (@{ email = "demo@directlet.ng"; password = "DemoPass123!" } | ConvertTo-Json)
$dh = @{ Authorization = "Bearer $($demo.accessToken)" }
Expect-Status "A landlord cannot open the admin panel" 403 { Invoke-RestMethod -Uri "$apiBase/admin/overview" -Headers $dh }
Expect-Status "Signed-out visitors cannot open it" 401 { Invoke-RestMethod -Uri "$apiBase/admin/overview" }
Expect-Status "Admins do not take part in chats" 403 { Invoke-RestMethod -Uri "$apiBase/conversations" -Headers $ah }

# --- Visit counting ---
$before = (Invoke-RestMethod -Uri "$apiBase/admin/overview" -Headers $ah).overview
$ua = "Mozilla/5.0 (Linux; Android 14) AdminTest/$suffix"
foreach ($path in "/compounds", "/compounds", "/register") {
  Invoke-WebRequest -Uri "$apiBase/analytics/pageview" -Method Post -ContentType $json -UserAgent $ua -Body (@{ path = $path; referrer = "https://www.google.com/search?q=flats" } | ConvertTo-Json) -UseBasicParsing | Out-Null
}
Invoke-WebRequest -Uri "$apiBase/analytics/pageview" -Method Post -ContentType $json -UserAgent "Googlebot/2.1" -Body (@{ path = "/compounds" } | ConvertTo-Json) -UseBasicParsing | Out-Null
$after = (Invoke-RestMethod -Uri "$apiBase/admin/overview" -Headers $ah).overview
Check "3 page views counted today (the bot is ignored)" (($after.traffic.viewsToday - $before.traffic.viewsToday) -eq 3) "(went from $($before.traffic.viewsToday) to $($after.traffic.viewsToday))"
Check "Same browser, same day = 1 new visitor" (($after.traffic.visitorsToday - $before.traffic.visitorsToday) -eq 1) "(went from $($before.traffic.visitorsToday) to $($after.traffic.visitorsToday))"
Check "Referrer is stored as the host only" (@($after.traffic.topReferrers | Where-Object { $_.referrer -eq "www.google.com" }).Count -eq 1) ""
Check "Visit counting adds nothing to the audit log" (-not (@((Invoke-RestMethod -Uri "$apiBase/admin/activity" -Headers $ah).entries | Where-Object { $_.path -like "/analytics*" }).Count)) ""
Expect-Status "A page view with a bad path is rejected" 400 { Invoke-RestMethod -Uri "$apiBase/analytics/pageview" -Method Post -ContentType $json -Body (@{ path = "not-a-path" } | ConvertTo-Json) }
Check "Overview has a 30-day series" ($after.series.Count -eq 30) "(got $($after.series.Count))"
Check "Overview counts landlords" ($after.users.byRole.LANDLORD -ge 1) ""

# --- Users ---
$landlordEmail = "suspendme.$suffix@example.com"
$landlord = Register "Suspend Me" $landlordEmail "LANDLORD"
$lh = @{ Authorization = "Bearer $($landlord.accessToken)" }
$property = (Invoke-RestMethod -Uri "$apiBase/properties" -Method Post -ContentType $json -Headers $lh -Body (@{ name = "Admin Test $suffix"; address = "1 Test Road"; area = "Surulere"; city = "Lagos"; state = "Lagos" } | ConvertTo-Json)).property
Invoke-RestMethod -Uri "$apiBase/properties/$($property.id)/units" -Method Post -ContentType $json -Headers $lh -Body (@{ label = "Flat 1"; bedrooms = 1; rentAmount = 600000 } | ConvertTo-Json) | Out-Null

$found = (Invoke-RestMethod -Uri "$apiBase/admin/users?q=suspendme.$suffix" -Headers $ah).users
Check "Search finds the user by email" ($found.Count -eq 1 -and $found[0].properties -eq 1) "(got $($found.Count))"
$onlyHunters = (Invoke-RestMethod -Uri "$apiBase/admin/users?role=HUNTER" -Headers $ah).users
Check "Role filter returns only house hunters" (@($onlyHunters | Where-Object { $_.role -ne "HUNTER" }).Count -eq 0) ""
Check "User list never includes password hashes" ($null -eq $found[0].passwordHash) ""
$detail = (Invoke-RestMethod -Uri "$apiBase/admin/users/$($landlord.user.id)" -Headers $ah).user
Check "User detail shows their property and recent actions" ($detail.properties.Count -eq 1 -and $detail.recentActivity.Count -ge 2) "(properties $($detail.properties.Count), actions $($detail.recentActivity.Count))"
Check "Sign-up is attributed to the new user in the log" (@($detail.recentActivity | Where-Object { $_.path -eq "/auth/register" }).Count -eq 1) ""

# --- Suspension ---
Expect-Status "An admin cannot suspend themself" 400 { Invoke-RestMethod -Uri "$apiBase/admin/users/$($admin.user.id)/suspend" -Method Post -ContentType $json -Headers $ah -Body "{}" }
Invoke-RestMethod -Uri "$apiBase/admin/users/$($landlord.user.id)/suspend" -Method Post -ContentType $json -Headers $ah -Body (@{ reason = "Test suspension" } | ConvertTo-Json) | Out-Null
Expect-Status "A suspended user cannot log in" 403 { Login $landlordEmail }
Expect-Status "A suspended landlord's listing is off the marketplace" 404 { Invoke-RestMethod -Uri "$apiBase/public/properties/$($property.id)" }
$suspendedList = (Invoke-RestMethod -Uri "$apiBase/admin/users?suspended=true" -Headers $ah).users
Check "Suspended filter lists them" (@($suspendedList | Where-Object { $_.id -eq $landlord.user.id }).Count -eq 1) ""
Invoke-RestMethod -Uri "$apiBase/admin/users/$($landlord.user.id)/unsuspend" -Method Post -Headers $ah | Out-Null
$back = Login $landlordEmail
Check "After lifting it, they can log in again" ($back.user.id -eq $landlord.user.id) ""
$lh = @{ Authorization = "Bearer $($back.accessToken)" }

# --- Taking a listing down ---
$public = Invoke-RestMethod -Uri "$apiBase/public/properties/$($property.id)"
Check "Listing is live again" ($public.property.id -eq $property.id) ""
Invoke-RestMethod -Uri "$apiBase/admin/properties/$($property.id)/hide" -Method Post -ContentType $json -Headers $ah -Body (@{ reason = "Reported as fake" } | ConvertTo-Json) | Out-Null
Expect-Status "A taken-down listing is off the marketplace" 404 { Invoke-RestMethod -Uri "$apiBase/public/properties/$($property.id)" }
Invoke-RestMethod -Uri "$apiBase/properties/$($property.id)" -Method Patch -ContentType $json -Headers $lh -Body (@{ isPublic = $true } | ConvertTo-Json) | Out-Null
Expect-Status "The owner re-listing it does not bring it back" 404 { Invoke-RestMethod -Uri "$apiBase/public/properties/$($property.id)" }
$own = (Invoke-RestMethod -Uri "$apiBase/properties/$($property.id)" -Headers $lh).property
Check "The owner sees why it was taken down" ($own.hiddenByAdminReason -eq "Reported as fake") ""
$hunter = Register "Hopeful Hunter" "hopeful.$suffix@example.com" "HUNTER"
Expect-Status "Hunters cannot message about a taken-down listing" 404 { Invoke-RestMethod -Uri "$apiBase/conversations" -Method Post -ContentType $json -Headers @{ Authorization = "Bearer $($hunter.accessToken)" } -Body (@{ propertyId = $property.id; body = "hi" } | ConvertTo-Json) }
$takenDown = (Invoke-RestMethod -Uri "$apiBase/admin/properties?hidden=true" -Headers $ah).properties | Where-Object { $_.id -eq $property.id }
Check "Admin list shows it as taken down with the reason" ($takenDown.visibleToPublic -eq $false -and $takenDown.hiddenByAdminReason -eq "Reported as fake") ""
Invoke-RestMethod -Uri "$apiBase/admin/properties/$($property.id)/unhide" -Method Post -Headers $ah | Out-Null
$restored = Invoke-RestMethod -Uri "$apiBase/public/properties/$($property.id)"
Check "Restoring puts it back on the marketplace" ($restored.property.id -eq $property.id) ""

$log = (Invoke-RestMethod -Uri "$apiBase/admin/activity?userId=$($admin.user.id)" -Headers $ah).entries
Check "Admin actions are in the activity log" (@($log | Where-Object { $_.path -like "/admin/*" }).Count -ge 4) "(got $(@($log | Where-Object { $_.path -like '/admin/*' }).Count))"

# Clean up: keep the test property off the marketplace.
Invoke-RestMethod -Uri "$apiBase/properties/$($property.id)" -Method Patch -ContentType $json -Headers $lh -Body (@{ isPublic = $false } | ConvertTo-Json) | Out-Null
Write-Host "=== Done. Test property hidden from the marketplace. ==="
