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
      $tenancyResult = Invoke-RestMethod -Uri "$apiBase/tenancies" -Method Post -ContentType "application/json" -Headers $landlordHeaders -WebSession $landlordSession -Body (@{ unitId = $unit.id; tenantEmail = "paytest.$(Get-Random)@example.com"; tenantFullName = "Pay Test Tenant"; startDate = (Get-Date -Format "yyyy-MM-dd") } | ConvertTo-Json)
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

Write-Host "=== Test tenancy created ==="
$tenancyResult | ConvertTo-Json -Depth 6

$inviteToken = $tenancyResult.inviteLink.Split("/")[-1]
$rentAmount = [decimal]$tenancyResult.tenancy.rentAmount

$acceptResult = Invoke-RestMethod -Uri "$apiBase/auth/invite/$inviteToken/accept" -Method Post -ContentType "application/json" -Body (@{ password = $testPassword } | ConvertTo-Json) -SessionVariable tenantSession
$tenantHeaders = @{ Authorization = "Bearer $($acceptResult.accessToken)" }
Write-Host "=== Tenant invite accepted, logged in ==="

$mine = Invoke-RestMethod -Uri "$apiBase/tenancies/mine" -Method Get -Headers $tenantHeaders -WebSession $tenantSession
Write-Host "=== Tenant own tenancy view ==="
$mine | ConvertTo-Json -Depth 6

$firstAmount = [math]::Round($rentAmount * 0.6, 2)
$secondAmount = $rentAmount - $firstAmount

$payment1 = Invoke-RestMethod -Uri "$apiBase/payments" -Method Post -ContentType "application/json" -Headers $tenantHeaders -WebSession $tenantSession -Body (@{ tenancyId = $tenancyId; amount = $firstAmount; method = "BANK_TRANSFER"; paidAt = (Get-Date -Format "o"); reference = "TXN-001" } | ConvertTo-Json)
Write-Host "=== Payment 1 recorded (PENDING, partial) ==="
$payment1 | ConvertTo-Json -Depth 6

$confirm1 = Invoke-RestMethod -Uri "$apiBase/payments/$($payment1.payment.id)/confirm" -Method Post -Headers $landlordHeaders -WebSession $landlordSession
Write-Host "=== Payment 1 confirmed (allocation + receipt) ==="
$confirm1 | ConvertTo-Json -Depth 6

$payment2 = Invoke-RestMethod -Uri "$apiBase/payments" -Method Post -ContentType "application/json" -Headers $tenantHeaders -WebSession $tenantSession -Body (@{ tenancyId = $tenancyId; amount = $secondAmount; method = "CASH"; paidAt = (Get-Date -Format "o") } | ConvertTo-Json)
Write-Host "=== Payment 2 recorded (PENDING, remainder) ==="
$payment2 | ConvertTo-Json -Depth 6

$confirm2 = Invoke-RestMethod -Uri "$apiBase/payments/$($payment2.payment.id)/confirm" -Method Post -Headers $landlordHeaders -WebSession $landlordSession
Write-Host "=== Payment 2 confirmed - charge should now be fully paid ==="
$confirm2 | ConvertTo-Json -Depth 6

$tenancyDetail = Invoke-RestMethod -Uri "$apiBase/tenancies/$tenancyId" -Method Get -Headers $landlordHeaders -WebSession $landlordSession
Write-Host "=== Rent charges after both confirmations ==="
$tenancyDetail.tenancy.rentCharges | ConvertTo-Json -Depth 6

$payment3 = Invoke-RestMethod -Uri "$apiBase/payments" -Method Post -ContentType "application/json" -Headers $tenantHeaders -WebSession $tenantSession -Body (@{ tenancyId = $tenancyId; amount = 1000; method = "OTHER"; paidAt = (Get-Date -Format "o") } | ConvertTo-Json)
Write-Host "=== Payment 3 recorded (will be rejected) ==="
$payment3 | ConvertTo-Json -Depth 6

$reject3 = Invoke-RestMethod -Uri "$apiBase/payments/$($payment3.payment.id)/reject" -Method Post -ContentType "application/json" -Headers $landlordHeaders -WebSession $landlordSession -Body (@{ rejectionReason = "Testing rejection flow" } | ConvertTo-Json)
Write-Host "=== Payment 3 rejected ==="
$reject3 | ConvertTo-Json -Depth 6

$payment4 = Invoke-RestMethod -Uri "$apiBase/payments" -Method Post -ContentType "application/json" -Headers $tenantHeaders -WebSession $tenantSession -Body (@{ tenancyId = $tenancyId; amount = 5000; method = "OTHER"; paidAt = (Get-Date -Format "o") } | ConvertTo-Json)

try {
  $confirm4 = Invoke-RestMethod -Uri "$apiBase/payments/$($payment4.payment.id)/confirm" -Method Post -Headers $landlordHeaders -WebSession $landlordSession
  Write-Host "=== UNEXPECTED: payment 4 confirmed ==="
  $confirm4 | ConvertTo-Json -Depth 6
} catch {
  Write-Host "=== Expected: payment 4 confirm blocked (exceeds outstanding) ==="
  $_.ErrorDetails.Message
}

$allPayments = Invoke-RestMethod -Uri "$apiBase/payments" -Method Get -Headers $landlordHeaders -WebSession $landlordSession
Write-Host "=== Landlord full payments list ==="
$allPayments | ConvertTo-Json -Depth 6
