# Adjust this if your api dev server runs on a different port.
$apiBase = if ($env:API_BASE) { $env:API_BASE } else { "http://localhost:4000" }
$repoRoot = Split-Path -Parent $PSScriptRoot

$landlordLogin = Invoke-RestMethod -Uri "$apiBase/auth/login" -Method Post -ContentType "application/json" -Body (@{ email = "demo@directlet.ng"; password = "DemoPass123!" } | ConvertTo-Json) -SessionVariable landlordSession
$landlordHeaders = @{ Authorization = "Bearer $($landlordLogin.accessToken)" }
Write-Host "=== Landlord logged in ==="

$before = Invoke-RestMethod -Uri "$apiBase/dashboard" -Method Get -Headers $landlordHeaders -WebSession $landlordSession
Write-Host "=== Dashboard totals (before) ==="
$before | ConvertTo-Json -Depth 6

# A tenancy that started 355 days ago is an annual one ending in 10 days,
# so the rent roll should issue next year's charge and a DUE_SOON reminder.
$startDate = (Get-Date).AddDays(-355).ToString("yyyy-MM-dd")
$properties = Invoke-RestMethod -Uri "$apiBase/properties" -Method Get -Headers $landlordHeaders -WebSession $landlordSession
$tenancyResult = $null
$tenancyId = $null

foreach ($property in $properties.properties) {
  $units = Invoke-RestMethod -Uri "$apiBase/properties/$($property.id)/units" -Method Get -Headers $landlordHeaders -WebSession $landlordSession
  foreach ($unit in $units.units) {
    if ($unit.rentFrequency -ne "ANNUAL") { continue }
    try {
      $tenancyResult = Invoke-RestMethod -Uri "$apiBase/tenancies" -Method Post -ContentType "application/json" -Headers $landlordHeaders -WebSession $landlordSession -Body (@{ unitId = $unit.id; tenantEmail = "remindertest.$(Get-Random)@example.com"; tenantFullName = "Reminder Test Tenant"; startDate = $startDate } | ConvertTo-Json)
      $tenancyId = $tenancyResult.tenancy.id
    } catch {
      Write-Host "Unit $($unit.id) occupied, trying next..."
    }
    if ($tenancyId) { break }
  }
  if ($tenancyId) { break }
}

if (-not $tenancyId) {
  Write-Host "No free annual unit found across any property. Stopping."
  exit
}
Write-Host "=== Test tenancy created: $tenancyId (started $startDate) ==="

Write-Host "=== Running rent roll ==="
pnpm --silent --dir "$repoRoot" --filter @directlet/api jobs:rent-roll

$tenancy = Invoke-RestMethod -Uri "$apiBase/tenancies/$tenancyId" -Method Get -Headers $landlordHeaders -WebSession $landlordSession
Write-Host "=== Rent charges after roll (expect 2) ==="
$tenancy.tenancy.rentCharges | Select-Object periodStart, periodEnd, dueDate, amount, amountPaid | Format-Table

Write-Host "=== Running rent roll again (expect chargesCreated 0 for this tenancy) ==="
pnpm --silent --dir "$repoRoot" --filter @directlet/api jobs:rent-roll

$inviteToken = $tenancyResult.inviteLink.Split("/")[-1]
$acceptResult = Invoke-RestMethod -Uri "$apiBase/auth/invite/$inviteToken/accept" -Method Post -ContentType "application/json" -Body (@{ password = "ReminderTestPass123!" } | ConvertTo-Json) -SessionVariable tenantSession
$tenantHeaders = @{ Authorization = "Bearer $($acceptResult.accessToken)" }
Write-Host "=== Tenant invite accepted, logged in ==="

$tenantReminders = Invoke-RestMethod -Uri "$apiBase/reminders" -Method Get -Headers $tenantHeaders -WebSession $tenantSession
Write-Host "=== Tenant reminders (expect OVERDUE for the first year, DUE_SOON for the next) ==="
$tenantReminders.reminders | Select-Object kind, dueDate, daysUntilDue, balance | Format-Table

try {
  Invoke-RestMethod -Uri "$apiBase/dashboard" -Method Get -Headers $tenantHeaders -WebSession $tenantSession
  Write-Host "=== UNEXPECTED: tenant was allowed to read the landlord dashboard ==="
} catch {
  Write-Host "=== Expected: tenant blocked from the dashboard ==="
  $_.ErrorDetails.Message
}

$payment = Invoke-RestMethod -Uri "$apiBase/payments" -Method Post -ContentType "application/json" -Headers $tenantHeaders -WebSession $tenantSession -Body (@{ tenancyId = $tenancyId; amount = [double]$tenancy.tenancy.rentAmount; method = "BANK_TRANSFER"; paidAt = (Get-Date -Format "yyyy-MM-dd") } | ConvertTo-Json)
Invoke-RestMethod -Uri "$apiBase/payments/$($payment.payment.id)/confirm" -Method Post -Headers $landlordHeaders -WebSession $landlordSession | Out-Null
Write-Host "=== Tenant paid one year, landlord confirmed ==="

$after = Invoke-RestMethod -Uri "$apiBase/dashboard" -Method Get -Headers $landlordHeaders -WebSession $landlordSession
Write-Host "=== Dashboard totals (after; collected up by one year's rent, outstanding up by one year's rent) ==="
$after | ConvertTo-Json -Depth 6

Start-Sleep -Seconds 1
$activity = Invoke-RestMethod -Uri "$apiBase/dashboard/activity" -Method Get -Headers $landlordHeaders -WebSession $landlordSession
Write-Host "=== Recent activity (paths must show :id, never a raw id or token) ==="
$activity.activity | Select-Object -First 5 method, path, entity, entityId, @{ n = "user"; e = { $_.user.fullName } } | Format-Table -AutoSize
