# Adjust this if your api dev server runs on a different port.
$apiBase = if ($env:API_BASE) { $env:API_BASE } else { "http://localhost:4000" }

$landlordLogin = Invoke-RestMethod -Uri "$apiBase/auth/login" -Method Post -ContentType "application/json" -Body (@{ email = "demo@directlet.ng"; password = "DemoPass123!" } | ConvertTo-Json) -SessionVariable landlordSession
$landlordHeaders = @{ Authorization = "Bearer $($landlordLogin.accessToken)" }
Write-Host "=== Landlord logged in ==="

$property = Invoke-RestMethod -Uri "$apiBase/properties" -Method Post -ContentType "application/json" -Headers $landlordHeaders -WebSession $landlordSession -Body (@{ name = "Inspection Test Property"; address = "1 Test Close"; area = "Test Area"; city = "Lagos"; state = "Lagos"; isPublic = $true } | ConvertTo-Json)
$propertyId = $property.property.id
Write-Host "=== Test property created: $propertyId ==="

$unit = Invoke-RestMethod -Uri "$apiBase/properties/$propertyId/units" -Method Post -ContentType "application/json" -Headers $landlordHeaders -WebSession $landlordSession -Body (@{ label = "Test Unit"; bedrooms = 2; bathrooms = 1; rentAmount = 500000; rentFrequency = "MONTHLY" } | ConvertTo-Json)
$unitId = $unit.unit.id
Write-Host "=== Test unit created: $unitId ==="

$reqA = Invoke-RestMethod -Uri "$apiBase/public/units/$unitId/inspection-requests" -Method Post -ContentType "application/json" -Body (@{ name = "Visitor A"; email = "visitora@example.com"; phone = "08010000001"; message = "Interested, can view weekends"; preferredDate = (Get-Date).AddDays(3).ToString("yyyy-MM-dd") } | ConvertTo-Json)
$reqB = Invoke-RestMethod -Uri "$apiBase/public/units/$unitId/inspection-requests" -Method Post -ContentType "application/json" -Body (@{ name = "Visitor B"; email = "visitorb@example.com"; phone = "08010000002" } | ConvertTo-Json)
$reqC = Invoke-RestMethod -Uri "$apiBase/public/units/$unitId/inspection-requests" -Method Post -ContentType "application/json" -Body (@{ name = "Visitor C"; email = "visitorc@example.com"; phone = "08010000003" } | ConvertTo-Json)
$reqD = Invoke-RestMethod -Uri "$apiBase/public/units/$unitId/inspection-requests" -Method Post -ContentType "application/json" -Body (@{ name = "Visitor D"; email = "visitord@example.com"; phone = "08010000004" } | ConvertTo-Json)
Write-Host "=== 4 public inspection requests submitted (no auth) ==="

$schedule = Invoke-RestMethod -Uri "$apiBase/inspections/$($reqA.inspectionRequest.id)/schedule" -Method Post -ContentType "application/json" -Headers $landlordHeaders -WebSession $landlordSession -Body (@{ scheduledFor = (Get-Date).AddDays(1).ToString("yyyy-MM-dd") } | ConvertTo-Json)
Write-Host "=== Visitor A scheduled ==="
$schedule | ConvertTo-Json -Depth 6

$decline = Invoke-RestMethod -Uri "$apiBase/inspections/$($reqB.inspectionRequest.id)/decline" -Method Post -ContentType "application/json" -Headers $landlordHeaders -WebSession $landlordSession -Body (@{ landlordNote = "Unit no longer available for viewing" } | ConvertTo-Json)
Write-Host "=== Visitor B declined ==="
$decline | ConvertTo-Json -Depth 6

$complete = Invoke-RestMethod -Uri "$apiBase/inspections/$($reqC.inspectionRequest.id)/complete" -Method Post -Headers $landlordHeaders -WebSession $landlordSession
Write-Host "=== Visitor C marked complete ==="
$complete | ConvertTo-Json -Depth 6

$convert = Invoke-RestMethod -Uri "$apiBase/inspections/$($reqD.inspectionRequest.id)/convert" -Method Post -ContentType "application/json" -Headers $landlordHeaders -WebSession $landlordSession -Body (@{ tenantEmail = "visitord@example.com"; tenantFullName = "Visitor D"; startDate = (Get-Date).ToString("yyyy-MM-dd") } | ConvertTo-Json)
Write-Host "=== Visitor D converted into a tenancy ==="
$convert | ConvertTo-Json -Depth 6

try {
  Invoke-RestMethod -Uri "$apiBase/inspections/$($reqD.inspectionRequest.id)/convert" -Method Post -ContentType "application/json" -Headers $landlordHeaders -WebSession $landlordSession -Body (@{ tenantEmail = "visitord@example.com"; tenantFullName = "Visitor D"; startDate = (Get-Date).ToString("yyyy-MM-dd") } | ConvertTo-Json)
  Write-Host "=== UNEXPECTED: converted a second time ==="
} catch {
  Write-Host "=== Expected: second conversion blocked ==="
  $_.ErrorDetails.Message
}

$finalList = Invoke-RestMethod -Uri "$apiBase/inspections" -Method Get -Headers $landlordHeaders -WebSession $landlordSession
Write-Host "=== Final inspection requests list ==="
$finalList | ConvertTo-Json -Depth 6
