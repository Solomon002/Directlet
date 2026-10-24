# Adjust this if your api dev server runs on a different port.
$apiBase = if ($env:API_BASE) { $env:API_BASE } else { "http://localhost:4000" }
if (-not $env:DEMO_PASSWORD) { throw "Set DEMO_PASSWORD to the demo landlord's password first (not stored in the repo)." }
# A fresh random password for every test account, so none is ever written in the repo.
$testPassword = "Tp-" + [guid]::NewGuid().ToString("N")

$landlordLogin = Invoke-RestMethod -Uri "$apiBase/auth/login" -Method Post -ContentType "application/json" -Body (@{ email = "demo@directlet.ng"; password = $env:DEMO_PASSWORD } | ConvertTo-Json) -SessionVariable landlordSession
$landlordHeaders = @{ Authorization = "Bearer $($landlordLogin.accessToken)" }
Write-Host "=== Landlord logged in ==="

$properties = Invoke-RestMethod -Uri "$apiBase/properties" -Method Get -Headers $landlordHeaders -WebSession $landlordSession
$tenancyResult = $null
$tenancyId = $null

foreach ($property in $properties.properties) {
  $units = Invoke-RestMethod -Uri "$apiBase/properties/$($property.id)/units" -Method Get -Headers $landlordHeaders -WebSession $landlordSession
  foreach ($unit in $units.units) {
    try {
      $tenancyResult = Invoke-RestMethod -Uri "$apiBase/tenancies" -Method Post -ContentType "application/json" -Headers $landlordHeaders -WebSession $landlordSession -Body (@{ unitId = $unit.id; tenantEmail = "complainttest.$(Get-Random)@example.com"; tenantFullName = "Complaint Test Tenant"; startDate = (Get-Date -Format "yyyy-MM-dd") } | ConvertTo-Json)
      $tenancyId = $tenancyResult.tenancy.id
    } catch {
      Write-Host "Unit $($unit.id) occupied, trying next..."
    }
    if ($tenancyId) { break }
  }
  if ($tenancyId) { break }
}

if (-not $tenancyId) {
  Write-Host "No free unit found across any property. Stopping."
  exit
}

Write-Host "=== Test tenancy created: $tenancyId ==="

$inviteToken = $tenancyResult.inviteLink.Split("/")[-1]
$acceptResult = Invoke-RestMethod -Uri "$apiBase/auth/invite/$inviteToken/accept" -Method Post -ContentType "application/json" -Body (@{ password = $testPassword } | ConvertTo-Json) -SessionVariable tenantSession
$tenantHeaders = @{ Authorization = "Bearer $($acceptResult.accessToken)" }
Write-Host "=== Tenant invite accepted, logged in ==="

$complaint1 = Invoke-RestMethod -Uri "$apiBase/complaints" -Method Post -ContentType "application/json" -Headers $tenantHeaders -WebSession $tenantSession -Body (@{ tenancyId = $tenancyId; title = "Leaking kitchen tap"; description = "The kitchen tap has been dripping steadily for three days." } | ConvertTo-Json)
Write-Host "=== Complaint 1 filed ==="
$complaint1 | ConvertTo-Json -Depth 6

$complaint2 = Invoke-RestMethod -Uri "$apiBase/complaints" -Method Post -ContentType "application/json" -Headers $tenantHeaders -WebSession $tenantSession -Body (@{ tenancyId = $tenancyId; title = "Broken window lock"; description = "The living room window lock will not latch shut." } | ConvertTo-Json)
Write-Host "=== Complaint 2 filed ==="
$complaint2 | ConvertTo-Json -Depth 6

$tenantList = Invoke-RestMethod -Uri "$apiBase/complaints" -Method Get -Headers $tenantHeaders -WebSession $tenantSession
Write-Host "=== Tenant own complaints list ==="
$tenantList | ConvertTo-Json -Depth 6

$landlordList = Invoke-RestMethod -Uri "$apiBase/complaints" -Method Get -Headers $landlordHeaders -WebSession $landlordSession
Write-Host "=== Landlord complaints list ==="
$landlordList | ConvertTo-Json -Depth 6

$update1 = Invoke-RestMethod -Uri "$apiBase/complaints/$($complaint1.complaint.id)/status" -Method Post -ContentType "application/json" -Headers $landlordHeaders -WebSession $landlordSession -Body (@{ status = "IN_PROGRESS"; landlordNote = "Plumber booked for Thursday" } | ConvertTo-Json)
Write-Host "=== Complaint 1 set to IN_PROGRESS ==="
$update1 | ConvertTo-Json -Depth 6

$update2 = Invoke-RestMethod -Uri "$apiBase/complaints/$($complaint2.complaint.id)/status" -Method Post -ContentType "application/json" -Headers $landlordHeaders -WebSession $landlordSession -Body (@{ status = "RESOLVED"; landlordNote = "Lock replaced" } | ConvertTo-Json)
Write-Host "=== Complaint 2 set to RESOLVED (check resolvedAt) ==="
$update2 | ConvertTo-Json -Depth 6

try {
  Invoke-RestMethod -Uri "$apiBase/complaints/$($complaint1.complaint.id)/status" -Method Post -ContentType "application/json" -Headers $tenantHeaders -WebSession $tenantSession -Body (@{ status = "RESOLVED" } | ConvertTo-Json)
  Write-Host "=== UNEXPECTED: tenant was allowed to update status ==="
} catch {
  Write-Host "=== Expected: tenant blocked from updating status ==="
  $_.ErrorDetails.Message
}

$tenantListAfter = Invoke-RestMethod -Uri "$apiBase/complaints" -Method Get -Headers $tenantHeaders -WebSession $tenantSession
Write-Host "=== Tenant complaints list after updates ==="
$tenantListAfter | ConvertTo-Json -Depth 6
