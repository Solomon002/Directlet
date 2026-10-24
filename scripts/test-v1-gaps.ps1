# Tests vacancy, viewing blocks, proof of payment, ending a tenancy, and
# editing/deleting properties and flats. Creates its own test property and
# hides it from the marketplace at the end.
$apiBase = if ($env:API_BASE) { $env:API_BASE } else { "http://localhost:4000" }

function Get-StatusCode($err) {
  return [int]$err.Exception.Response.StatusCode
}

function Expect-Status($label, $expected, [scriptblock]$call) {
  try {
    & $call | Out-Null
    Write-Host "FAIL  $label (expected $expected, got success)" -ForegroundColor Red
  } catch {
    $code = Get-StatusCode $_
    if ($code -eq $expected) {
      Write-Host "PASS  $label ($code)" -ForegroundColor Green
    } else {
      Write-Host "FAIL  $label (expected $expected, got $code) $($_.ErrorDetails.Message)" -ForegroundColor Red
    }
  }
}

function Check($label, $condition, $detail) {
  if ($condition) {
    Write-Host "PASS  $label" -ForegroundColor Green
  } else {
    Write-Host "FAIL  $label $detail" -ForegroundColor Red
  }
}

$json = "application/json"
$landlordLogin = Invoke-RestMethod -Uri "$apiBase/auth/login" -Method Post -ContentType $json -Body (@{ email = "demo@directlet.ng"; password = "DemoPass123!" } | ConvertTo-Json) -SessionVariable landlordSession
$lh = @{ Authorization = "Bearer $($landlordLogin.accessToken)" }
$suffix = Get-Random

# --- Property and flats, and partial edits keeping their values ---
$property = (Invoke-RestMethod -Uri "$apiBase/properties" -Method Post -ContentType $json -Headers $lh -Body (@{ name = "V1 Gap Test $suffix"; address = "1 Test Close"; area = "Yaba"; city = "Lagos"; state = "Lagos" } | ConvertTo-Json)).property
$unitA = (Invoke-RestMethod -Uri "$apiBase/properties/$($property.id)/units" -Method Post -ContentType $json -Headers $lh -Body (@{ label = "Flat A"; bedrooms = 2; rentAmount = 50000; rentFrequency = "MONTHLY" } | ConvertTo-Json)).unit
$unitB = (Invoke-RestMethod -Uri "$apiBase/properties/$($property.id)/units" -Method Post -ContentType $json -Headers $lh -Body (@{ label = "Flat B"; bedrooms = 1; rentAmount = 900000 } | ConvertTo-Json)).unit
Write-Host "=== Test property $($property.id) with Flat A (monthly) and Flat B ==="

$editedA = (Invoke-RestMethod -Uri "$apiBase/properties/$($property.id)/units/$($unitA.id)" -Method Patch -ContentType $json -Headers $lh -Body (@{ rentAmount = 55000 } | ConvertTo-Json)).unit
Check "Editing only the rent keeps the flat's frequency" ($editedA.rentFrequency -eq "MONTHLY" -and [double]$editedA.rentAmount -eq 55000) "(got $($editedA.rentFrequency), $($editedA.rentAmount))"

Invoke-RestMethod -Uri "$apiBase/properties/$($property.id)" -Method Patch -ContentType $json -Headers $lh -Body (@{ isPublic = $false } | ConvertTo-Json) | Out-Null
$renamed = (Invoke-RestMethod -Uri "$apiBase/properties/$($property.id)" -Method Patch -ContentType $json -Headers $lh -Body (@{ name = "V1 Gap Test $suffix (renamed)" } | ConvertTo-Json)).property
Check "Renaming keeps a hidden property hidden" ($renamed.isPublic -eq $false) "(isPublic is $($renamed.isPublic))"
Expect-Status "Hidden property is not on the public site" 404 { Invoke-RestMethod -Uri "$apiBase/public/properties/$($property.id)" }
Invoke-RestMethod -Uri "$apiBase/properties/$($property.id)" -Method Patch -ContentType $json -Headers $lh -Body (@{ isPublic = $true } | ConvertTo-Json) | Out-Null

# --- Tenant moves into Flat A ---
$tenancyResult = Invoke-RestMethod -Uri "$apiBase/tenancies" -Method Post -ContentType $json -Headers $lh -Body (@{ unitId = $unitA.id; tenantEmail = "v1gap.$suffix@example.com"; tenantFullName = "V1 Gap Tenant"; startDate = (Get-Date -Format "yyyy-MM-dd") } | ConvertTo-Json)
$tenancyId = $tenancyResult.tenancy.id
$inviteToken = $tenancyResult.inviteLink.Split("/")[-1]
$tenantLogin = Invoke-RestMethod -Uri "$apiBase/auth/invite/$inviteToken/accept" -Method Post -ContentType $json -Body (@{ password = "V1GapPass123!" } | ConvertTo-Json)
$th = @{ Authorization = "Bearer $($tenantLogin.accessToken)" }
Write-Host "=== Tenant V1 Gap Tenant (v1gap.$suffix@example.com / V1GapPass123!) moved into Flat A ==="

# --- Vacancy on the public site ---
$public = (Invoke-RestMethod -Uri "$apiBase/public/properties/$($property.id)").property
$pubA = $public.units | Where-Object { $_.id -eq $unitA.id }
$pubB = $public.units | Where-Object { $_.id -eq $unitB.id }
Check "Public page shows Flat A as let" ($pubA.isVacant -eq $false) "(isVacant $($pubA.isVacant))"
Check "Public page shows Flat B as vacant" ($pubB.isVacant -eq $true) "(isVacant $($pubB.isVacant))"
Check "Public page leaks no landlord id" ($null -eq $public.landlordId) ""

$listing = (Invoke-RestMethod -Uri "$apiBase/public/properties?city=lagos&area=yaba&pageSize=50").properties | Where-Object { $_.id -eq $property.id }
Check "Browse filter (city=lagos, area=yaba) finds the property" ($null -ne $listing) ""
Check "Browse shows 1 of 2 flats vacant" ($listing.vacantUnitCount -eq 1 -and $listing.unitCount -eq 2) "(got $($listing.vacantUnitCount) of $($listing.unitCount))"
$otherCity = (Invoke-RestMethod -Uri "$apiBase/public/properties?city=abuja&pageSize=50").properties | Where-Object { $_.id -eq $property.id }
Check "Browse filter (city=abuja) excludes it" ($null -eq $otherCity) ""

$viewing = @{ name = "Visitor"; email = "visitor.$suffix@example.com"; phone = "08012345678" } | ConvertTo-Json
Expect-Status "Viewing request for a let flat is blocked" 409 { Invoke-RestMethod -Uri "$apiBase/public/units/$($unitA.id)/inspection-requests" -Method Post -ContentType $json -Body $viewing }
$okViewing = Invoke-RestMethod -Uri "$apiBase/public/units/$($unitB.id)/inspection-requests" -Method Post -ContentType $json -Body $viewing
Check "Viewing request for a vacant flat works" ($null -ne $okViewing.inspectionRequest.id) ""

# --- Proof of payment ---
$payment = (Invoke-RestMethod -Uri "$apiBase/payments" -Method Post -ContentType $json -Headers $th -Body (@{ tenancyId = $tenancyId; amount = 55000; method = "BANK_TRANSFER"; paidAt = (Get-Date -Format "yyyy-MM-dd") } | ConvertTo-Json)).payment

[byte[]]$png = @(0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A) + [byte[]](1..200 | ForEach-Object { $_ % 256 })
$proof = Invoke-RestMethod -Uri "$apiBase/payments/$($payment.id)/proof" -Method Post -ContentType "image/png" -Headers $th -Body $png
Check "Tenant uploads a PNG proof" ($proof.proof.contentType -eq "image/png" -and $proof.proof.sizeBytes -eq $png.Length) "(got $($proof.proof.contentType), $($proof.proof.sizeBytes) bytes)"

[byte[]]$fake = [System.Text.Encoding]::ASCII.GetBytes("this is not really an image")
Expect-Status "Text pretending to be a PNG is rejected" 415 { Invoke-RestMethod -Uri "$apiBase/payments/$($payment.id)/proof" -Method Post -ContentType "image/png" -Headers $th -Body $fake }
Expect-Status "Unsupported content type is rejected" 415 { Invoke-RestMethod -Uri "$apiBase/payments/$($payment.id)/proof" -Method Post -ContentType "text/plain" -Headers $th -Body $fake }
[byte[]]$big = New-Object byte[] (3 * 1024 * 1024)
$png.CopyTo($big, 0)
Expect-Status "A 3 MB file is rejected" 413 { Invoke-RestMethod -Uri "$apiBase/payments/$($payment.id)/proof" -Method Post -ContentType "image/png" -Headers $th -Body $big }
Expect-Status "Landlord cannot upload proof" 403 { Invoke-RestMethod -Uri "$apiBase/payments/$($payment.id)/proof" -Method Post -ContentType "image/png" -Headers $lh -Body $png }

$download = Invoke-WebRequest -Uri "$apiBase/payments/$($payment.id)/proof" -Headers $lh -UseBasicParsing
Check "Landlord can view the proof" ($download.Headers["Content-Type"] -eq "image/png" -and $download.RawContentStream.Length -eq $png.Length) "(got $($download.Headers["Content-Type"]), $($download.RawContentStream.Length) bytes)"

$landlordPayment = (Invoke-RestMethod -Uri "$apiBase/payments" -Headers $lh).payments | Where-Object { $_.id -eq $payment.id }
Check "Payment list says proof is attached, without the file" ($landlordPayment.proof.sizeBytes -eq $png.Length -and $null -eq $landlordPayment.proof.data) ""

Invoke-RestMethod -Uri "$apiBase/payments/$($payment.id)/confirm" -Method Post -Headers $lh | Out-Null
Expect-Status "Proof cannot change after the payment is confirmed" 409 { Invoke-RestMethod -Uri "$apiBase/payments/$($payment.id)/proof" -Method Post -ContentType "image/png" -Headers $th -Body $png }

# --- Ending the tenancy ---
$ended = (Invoke-RestMethod -Uri "$apiBase/tenancies/$tenancyId/end" -Method Post -Headers $lh).tenancy
Check "Tenancy is ended" ($ended.status -eq "ENDED" -and $null -ne $ended.endedAt) ""
$publicAfter = (Invoke-RestMethod -Uri "$apiBase/public/properties/$($property.id)").property
Check "Flat A is vacant again on the public page" (($publicAfter.units | Where-Object { $_.id -eq $unitA.id }).isVacant -eq $true) ""
Expect-Status "Ending it twice is refused" 409 { Invoke-RestMethod -Uri "$apiBase/tenancies/$tenancyId/end" -Method Post -Headers $lh }

# --- Deleting ---
Expect-Status "Flat A has tenancy history, so it cannot be deleted" 409 { Invoke-RestMethod -Uri "$apiBase/properties/$($property.id)/units/$($unitA.id)" -Method Delete -Headers $lh }
Invoke-RestMethod -Uri "$apiBase/properties/$($property.id)/units/$($unitB.id)" -Method Delete -Headers $lh | Out-Null
$remaining = (Invoke-RestMethod -Uri "$apiBase/properties/$($property.id)" -Headers $lh).property.units
Check "Flat B (no history) is deleted" ($remaining.Count -eq 1) "(flats left: $($remaining.Count))"
Expect-Status "Property with tenancy history cannot be deleted" 409 { Invoke-RestMethod -Uri "$apiBase/properties/$($property.id)" -Method Delete -Headers $lh }

$throwaway = (Invoke-RestMethod -Uri "$apiBase/properties" -Method Post -ContentType $json -Headers $lh -Body (@{ name = "Throwaway $suffix"; address = "2 Test Close"; area = "Yaba"; city = "Lagos"; state = "Lagos" } | ConvertTo-Json)).property
Invoke-RestMethod -Uri "$apiBase/properties/$($throwaway.id)" -Method Delete -Headers $lh | Out-Null
Expect-Status "A property with no history is deleted" 404 { Invoke-RestMethod -Uri "$apiBase/properties/$($throwaway.id)" -Headers $lh }

# Keep the test property off the marketplace.
Invoke-RestMethod -Uri "$apiBase/properties/$($property.id)" -Method Patch -ContentType $json -Headers $lh -Body (@{ isPublic = $false } | ConvertTo-Json) | Out-Null
Write-Host "=== Done. Test property hidden from the marketplace. ==="
