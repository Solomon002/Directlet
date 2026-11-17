# Tests the "are you a robot" check on sign-up (hCaptcha).
#
# Start the API with hCaptcha's published TEST keys, which always accept a test answer:
#   HCAPTCHA_SITEKEY=10000000-ffff-ffff-ffff-000000000001
#   HCAPTCHA_SECRET=0x0000000000000000000000000000000000000000
# Then run:   $env:API_BASE = "http://localhost:4100"; .\scripts\test-captcha.ps1
#
# To test the refusal, start the API with a wrong HCAPTCHA_SECRET (any other 10+ character
# value), set $env:EXPECT = "reject", and run it again.
# Creates its own accounts with random passwords; nothing is stored in the repo.
$apiBase = if ($env:API_BASE) { $env:API_BASE } else { "http://localhost:4000" }
$expectReject = $env:EXPECT -eq "reject"
$testPassword = "Tp-" + [guid]::NewGuid().ToString("N")
$json = "application/json"
$suffix = Get-Random
# hCaptcha's documented test answer for the test keys.
$testToken = "10000000-aaaa-bbbb-cccc-000000000001"

function Expect-Status($label, $expected, $expectedCode, [scriptblock]$call) {
  try {
    & $call | Out-Null
    Write-Host "FAIL  $label (expected $expected, got success)" -ForegroundColor Red
  } catch {
    $code = [int]$_.Exception.Response.StatusCode
    $body = $_.ErrorDetails.Message
    if ($code -eq $expected -and (-not $expectedCode -or $body -match $expectedCode)) { Write-Host "PASS  $label ($code)" -ForegroundColor Green }
    else { Write-Host "FAIL  $label (expected $expected $expectedCode, got $code) $body" -ForegroundColor Red }
  }
}

function Check($label, $condition, $detail) {
  if ($condition) { Write-Host "PASS  $label" -ForegroundColor Green } else { Write-Host "FAIL  $label $detail" -ForegroundColor Red }
}

function Register($n, $extra = @{}) {
  $body = @{ fullName = "Vtest Captcha $n"; email = "vtest.c$n.$suffix@example.com"; password = $testPassword; accountType = "HUNTER" } + $extra
  return Invoke-RestMethod -Uri "$apiBase/auth/register" -Method Post -ContentType $json -Body ($body | ConvertTo-Json)
}

$config = Invoke-RestMethod -Uri "$apiBase/auth/config"
Check "The server tells the sign-up page which key to use" ($config.captchaSiteKey -eq "10000000-ffff-ffff-ffff-000000000001") "(got $($config.captchaSiteKey))"
Check "The secret is never sent to the browser" (($config | ConvertTo-Json) -notmatch "0x0000") ""

Expect-Status "Signing up without the check is refused" 400 "CAPTCHA_REQUIRED" { Register 1 }
Expect-Status "A made-up short answer is refused as invalid" 400 "" { Register 2 @{ captchaToken = "abc" } }

if ($expectReject) {
  Expect-Status "A wrong answer is rejected by hCaptcha" 400 "CAPTCHA_FAILED" { Register 3 @{ captchaToken = $testToken } }
} else {
  $ok = Register 3 @{ captchaToken = $testToken }
  Check "Signing up with a passed check works" ($ok.user.email -eq "vtest.c3.$suffix@example.com" -and $ok.accessToken) ""
  Check "The token is not stored on the account" ($null -eq $ok.user.captchaToken) ""
  $login = Invoke-RestMethod -Uri "$apiBase/auth/login" -Method Post -ContentType $json -Body (@{ email = "vtest.c3.$suffix@example.com"; password = $testPassword } | ConvertTo-Json)
  Check "The new account can log in (and login needs no check)" ($null -ne $login.accessToken) ""
}

Write-Host ""
Write-Host "Test accounts: vtest.c*.$suffix@example.com (left in the database; remove with the cleanup step)."
