# Tests listing photos: upload rules, duplicate and stolen-photo checks, cover photo,
# the public picture route and caching, limits, and who can touch what.
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

# A real 1x1 PNG. Extra trailing bytes make a different file (so a different hash)
# that still passes the picture check.
$basePng = [Convert]::FromBase64String("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==")
# The leading comma keeps PowerShell from unrolling the bytes into a plain object list,
# which would be sent as text instead of as a file.
function Png($variant) { return , [byte[]]($basePng + @(if ($variant -gt 0) { 1..$variant | ForEach-Object { [byte]($_ % 250) } })) }

function Upload($propertyId, $headers, $bytes, $contentType, $query = "") {
  return Invoke-RestMethod -Uri "$apiBase/properties/$propertyId/photos$query" -Method Post -Headers $headers -ContentType $contentType -Body $bytes
}

$suffix = Get-Random

Register "Vtest Admin" "vtest.padmin.$suffix@example.com" "HUNTER" | Out-Null
pnpm --silent --dir "$repoRoot" --filter @directlet/api admin:grant "vtest.padmin.$suffix@example.com" | Out-Null
$admin = Login "vtest.padmin.$suffix@example.com"
Register "Vtest Landlord A" "vtest.pa.$suffix@example.com" "LANDLORD" | Out-Null
Register "Vtest Landlord B" "vtest.pb.$suffix@example.com" "LANDLORD" | Out-Null
$a = Login "vtest.pa.$suffix@example.com"
$b = Login "vtest.pb.$suffix@example.com"

$pa = (Post "/properties" $a @{ name = "Vtest Photo House $suffix"; address = "1 Test Street"; area = "Yaba"; city = "Lagos"; state = "Lagos" }).property
$pb = (Post "/properties" $b @{ name = "Vtest Other House $suffix"; address = "2 Test Street"; area = "Yaba"; city = "Lagos"; state = "Lagos" }).property
$ua = (Post "/properties/$($pa.id)/units" $a @{ label = "Flat 1"; bedrooms = 2; rentAmount = 900000 }).unit

# --- Uploading ---
Check "A property starts with no photos" (@((Invoke-RestMethod -Uri "$apiBase/properties/$($pa.id)/photos" -Headers $a).photos).Count -eq 0) ""
$p1 = (Upload $pa.id $a (Png 0) "image/png").photo
Check "A picture is accepted" ($null -ne $p1.id -and $p1.position -eq 0) ""
Expect-Status "The same picture twice on one property is refused" 409 { Upload $pa.id $a (Png 0) "image/png" }
Expect-Status "Another landlord cannot reuse my picture (stolen-photo check)" 409 { Upload $pb.id $b (Png 0) "image/png" }
Expect-Status "A PDF is not a photo" 415 { Upload $pa.id $a ([System.Text.Encoding]::ASCII.GetBytes("%PDF-1.4 fake")) "application/pdf" }
Expect-Status "A file that only claims to be an image is refused" 415 { Upload $pa.id $a ([System.Text.Encoding]::ASCII.GetBytes("not a picture at all")) "image/png" }
Expect-Status "A text file is refused" 415 { Upload $pa.id $a ([System.Text.Encoding]::ASCII.GetBytes("hello")) "text/plain" }
Expect-Status "A file over 3 MB is refused" 413 { Upload $pa.id $a ([byte[]]($basePng + (New-Object byte[] (3 * 1024 * 1024 + 10)))) "image/png" }

# --- Whole property or one flat ---
$p2 = (Upload $pa.id $a (Png 2) "image/png" "?unitId=$($ua.id)").photo
Check "A picture can be tied to one flat" ($p2.unitId -eq $ua.id) ""
Expect-Status "A flat from another property is refused" 404 { Upload $pa.id $a (Png 3) "image/png" "?unitId=$([guid]::NewGuid())" }
Expect-Status "A malformed flat id is refused" 400 { Upload $pa.id $a (Png 3) "image/png" "?unitId=nope" }

# --- Access ---
Expect-Status "Another landlord cannot list my photos" 404 { Invoke-RestMethod -Uri "$apiBase/properties/$($pa.id)/photos" -Headers $b }
Expect-Status "Another landlord cannot delete my photo" 404 { Invoke-RestMethod -Uri "$apiBase/properties/$($pa.id)/photos/$($p1.id)" -Method Delete -Headers $b }
Expect-Status "Another landlord cannot add to my property" 404 { Upload $pa.id $b (Png 4) "image/png" }
Expect-Status "Signed-out visitors cannot upload" 401 { Invoke-RestMethod -Uri "$apiBase/properties/$($pa.id)/photos" -Method Post -ContentType "image/png" -Body (Png 5) }

# --- Cover ---
Post "/properties/$($pa.id)/photos/$($p2.id)/cover" $a @{} | Out-Null
$listed = (Invoke-RestMethod -Uri "$apiBase/properties/$($pa.id)/photos" -Headers $a).photos
Check "Making a photo the cover puts it first" ($listed[0].id -eq $p2.id) "(first is $($listed[0].id))"
Expect-Status "Another landlord cannot change my cover" 404 { Post "/properties/$($pa.id)/photos/$($p1.id)/cover" $b @{} }

# --- Public ---
$pub = (Invoke-RestMethod -Uri "$apiBase/public/properties/$($pa.id)").property
Check "The public page lists the photos, cover first" ($pub.photos.Count -eq 2 -and $pub.photos[0].id -eq $p2.id) "(got $($pub.photos.Count))"
Check "A flat's picture says which flat" ($pub.photos[0].unitId -eq $ua.id) ""
$img = Invoke-WebRequest -Uri "$apiBase/public/photos/$($p1.id)" -UseBasicParsing
Check "A picture is served to anyone, as an image" ($img.StatusCode -eq 200 -and $img.Headers["Content-Type"] -eq "image/png") ""
Check "It is cached for a long time" ($img.Headers["Cache-Control"] -match "immutable" -and $img.Headers["Cache-Control"] -match "public") "(got $($img.Headers['Cache-Control']))"
Check "It can be shown from another address (the website)" ($img.Headers["Cross-Origin-Resource-Policy"] -eq "cross-origin") ""
Check "The bytes served are the bytes uploaded" ($img.RawContentLength -eq (Png 0).Length) "(got $($img.RawContentLength))"
Expect-Status "An unknown picture id is a 404" 404 { Invoke-WebRequest -Uri "$apiBase/public/photos/$([guid]::NewGuid())" -UseBasicParsing }
$cardList = (Invoke-RestMethod -Uri "$apiBase/public/properties?pageSize=50").properties | Where-Object { $_.id -eq $pa.id }
Check "The listing card has the cover id and a photo count" ($cardList.coverPhotoId -eq $p2.id -and $cardList.photoCount -eq 2) "(got $($cardList.coverPhotoId), $($cardList.photoCount))"
Check "A property with none has no cover" ((Invoke-RestMethod -Uri "$apiBase/public/properties?pageSize=50").properties | Where-Object { $_.id -eq $pb.id } | ForEach-Object { $null -eq $_.coverPhotoId -and $_.photoCount -eq 0 }) ""

# --- Limit ---
$count = 2
foreach ($n in 6..15) { try { Upload $pa.id $a (Png $n) "image/png" | Out-Null; $count++ } catch { break } }
Check "A property holds 12 photos" ($count -eq 12) "(got $count)"
Expect-Status "A 13th photo is refused" 409 { Upload $pa.id $a (Png 40) "image/png" }

# --- Deleting and taking down ---
Invoke-RestMethod -Uri "$apiBase/properties/$($pa.id)/photos/$($p1.id)" -Method Delete -Headers $a | Out-Null
Expect-Status "A deleted photo is gone from the public route" 404 { Invoke-WebRequest -Uri "$apiBase/public/photos/$($p1.id)" -UseBasicParsing }
Post "/admin/properties/$($pa.id)/hide" $admin @{ reason = "test" } | Out-Null
Expect-Status "Photos of a listing an admin took down stop being served" 404 { Invoke-WebRequest -Uri "$apiBase/public/photos/$($p2.id)" -UseBasicParsing }
Invoke-RestMethod -Uri "$apiBase/admin/properties/$($pa.id)/unhide" -Method Post -Headers $admin | Out-Null
Check "They come back when it is restored" ((Invoke-WebRequest -Uri "$apiBase/public/photos/$($p2.id)" -UseBasicParsing).StatusCode -eq 200) ""

Write-Host ""
Write-Host "Test accounts: vtest.*.$suffix@example.com (left in the database; remove with the cleanup step)."
