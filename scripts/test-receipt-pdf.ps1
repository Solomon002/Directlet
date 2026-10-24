# Adjust this if your api dev server runs on a different port.
$apiBase = if ($env:API_BASE) { $env:API_BASE } else { "http://localhost:4000" }
if (-not $env:DEMO_PASSWORD) { throw "Set DEMO_PASSWORD to the demo landlord's password first (not stored in the repo)." }

$landlordLogin = Invoke-RestMethod -Uri "$apiBase/auth/login" -Method Post -ContentType "application/json" -Body (@{ email = "demo@directlet.ng"; password = $env:DEMO_PASSWORD } | ConvertTo-Json)
$landlordHeaders = @{ Authorization = "Bearer $($landlordLogin.accessToken)" }

Invoke-WebRequest -Uri "$apiBase/payments/2255bebb-758c-45dc-8bb1-18c5843f47c9/receipt" -Headers $landlordHeaders -OutFile "C:\Users\atans\Desktop\DirectLet\scripts\receipt-1.pdf"
Invoke-WebRequest -Uri "$apiBase/payments/0b05142f-fb12-4671-bddd-5c931134b551/receipt" -Headers $landlordHeaders -OutFile "C:\Users\atans\Desktop\DirectLet\scripts\receipt-2.pdf"

$bytes1 = [System.IO.File]::ReadAllBytes("C:\Users\atans\Desktop\DirectLet\scripts\receipt-1.pdf")
$bytes2 = [System.IO.File]::ReadAllBytes("C:\Users\atans\Desktop\DirectLet\scripts\receipt-2.pdf")
Write-Host "=== receipt-1.pdf ==="
Write-Host "header: $([System.Text.Encoding]::ASCII.GetString($bytes1[0..3]))  size: $($bytes1.Length) bytes"
Write-Host "=== receipt-2.pdf ==="
Write-Host "header: $([System.Text.Encoding]::ASCII.GetString($bytes2[0..3]))  size: $($bytes2.Length) bytes"

try {
  Invoke-WebRequest -Uri "$apiBase/payments/15ec301b-c74c-47c2-9b3d-a52e3d4f73f1/receipt" -Headers $landlordHeaders -OutFile "C:\Users\atans\Desktop\DirectLet\scripts\receipt-3-should-fail.pdf"
  Write-Host "=== UNEXPECTED: rejected payment returned a receipt ==="
} catch {
  Write-Host "=== Expected: rejected payment has no receipt ==="
  $_.ErrorDetails.Message
}
