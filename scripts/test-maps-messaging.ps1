# Tests map locations, house hunter accounts, and in-app messaging. Creates a
# test property with a pin, a hunter and a tenant, and hides the property at the end.
$apiBase = if ($env:API_BASE) { $env:API_BASE } else { "http://localhost:4000" }
$json = "application/json"

function Expect-Status($label, $expected, [scriptblock]$call) {
  try {
    & $call | Out-Null
    Write-Host "FAIL  $label (expected $expected, got success)" -ForegroundColor Red
  } catch {
    $code = [int]$_.Exception.Response.StatusCode
    if ($code -eq $expected) {
      Write-Host "PASS  $label ($code)" -ForegroundColor Green
    } else {
      Write-Host "FAIL  $label (expected $expected, got $code) $($_.ErrorDetails.Message)" -ForegroundColor Red
    }
  }
}

function Check($label, $condition, $detail) {
  if ($condition) { Write-Host "PASS  $label" -ForegroundColor Green } else { Write-Host "FAIL  $label $detail" -ForegroundColor Red }
}

$suffix = Get-Random
$landlord = Invoke-RestMethod -Uri "$apiBase/auth/login" -Method Post -ContentType $json -Body (@{ email = "demo@directlet.ng"; password = "DemoPass123!" } | ConvertTo-Json)
$lh = @{ Authorization = "Bearer $($landlord.accessToken)" }

# --- Map location ---
$property = (Invoke-RestMethod -Uri "$apiBase/properties" -Method Post -ContentType $json -Headers $lh -Body (@{ name = "Map Test $suffix"; address = "12 Herbert Macaulay Way"; area = "Yaba"; city = "Lagos"; state = "Lagos"; latitude = 6.5095; longitude = 3.3711 } | ConvertTo-Json)).property
$unit = (Invoke-RestMethod -Uri "$apiBase/properties/$($property.id)/units" -Method Post -ContentType $json -Headers $lh -Body (@{ label = "Flat 1"; bedrooms = 2; rentAmount = 1500000 } | ConvertTo-Json)).unit
Check "Property saved with a map pin" ($property.latitude -eq 6.5095 -and $property.longitude -eq 3.3711) "(got $($property.latitude), $($property.longitude))"

$public = (Invoke-RestMethod -Uri "$apiBase/public/properties/$($property.id)").property
Check "Public page includes the pin" ($public.latitude -eq 6.5095 -and $public.longitude -eq 3.3711) ""
$listed = (Invoke-RestMethod -Uri "$apiBase/public/properties?pageSize=50").properties | Where-Object { $_.id -eq $property.id }
Check "Browse list includes the pin (for the map view)" ($listed.latitude -eq 6.5095) ""

Expect-Status "Latitude out of range is rejected" 400 { Invoke-RestMethod -Uri "$apiBase/properties/$($property.id)" -Method Patch -ContentType $json -Headers $lh -Body (@{ latitude = 120 } | ConvertTo-Json) }
$renamed = (Invoke-RestMethod -Uri "$apiBase/properties/$($property.id)" -Method Patch -ContentType $json -Headers $lh -Body (@{ description = "Near Yaba market" } | ConvertTo-Json)).property
Check "Editing other fields keeps the pin" ($renamed.latitude -eq 6.5095) "(latitude now $($renamed.latitude))"

try {
  $geo = Invoke-RestMethod -Uri "$apiBase/properties/geocode?q=Yaba%2C%20Lagos" -Headers $lh
  Check "Address search returns Nigerian results" ($geo.results.Count -gt 0 -and $geo.results[0].latitude -gt 4 -and $geo.results[0].latitude -lt 14) "(got $($geo.results.Count) results)"
} catch {
  Write-Host "WARN  Address search failed ($([int]$_.Exception.Response.StatusCode)); OpenStreetMap may be unreachable from here" -ForegroundColor Yellow
}
Expect-Status "Address search needs 3+ characters" 400 { Invoke-RestMethod -Uri "$apiBase/properties/geocode?q=ab" -Headers $lh }

# --- House hunter account ---
$hunterEmail = "hunter.$suffix@example.com"
$hunter = Invoke-RestMethod -Uri "$apiBase/auth/register" -Method Post -ContentType $json -Body (@{ fullName = "Ada Hunter"; email = $hunterEmail; password = "HunterPass123!"; accountType = "HUNTER" } | ConvertTo-Json)
$hh = @{ Authorization = "Bearer $($hunter.accessToken)" }
Check "House hunter signs up with the HUNTER role" ($hunter.user.role -eq "HUNTER") "(got $($hunter.user.role))"
Write-Host "      Hunter login: $hunterEmail / HunterPass123!"

Expect-Status "Signing up as TENANT directly is refused" 400 { Invoke-RestMethod -Uri "$apiBase/auth/register" -Method Post -ContentType $json -Body (@{ fullName = "Sneaky"; email = "sneaky.$suffix@example.com"; password = "SneakyPass123!"; accountType = "TENANT" } | ConvertTo-Json) }
Expect-Status "Hunter cannot open the landlord dashboard" 403 { Invoke-RestMethod -Uri "$apiBase/dashboard" -Headers $hh }
Expect-Status "Hunter cannot list payments" 403 { Invoke-RestMethod -Uri "$apiBase/payments" -Headers $hh }
Expect-Status "Hunter cannot list properties as a landlord" 403 { Invoke-RestMethod -Uri "$apiBase/properties" -Headers $hh }

# --- Hunter messages the landlord ---
$conv = (Invoke-RestMethod -Uri "$apiBase/conversations" -Method Post -ContentType $json -Headers $hh -Body (@{ propertyId = $property.id; unitId = $unit.id; body = "Hello, is Flat 1 still available?" } | ConvertTo-Json)).conversation
Check "Hunter starts a chat about Flat 1" ($null -ne $conv.id) ""

$again = (Invoke-RestMethod -Uri "$apiBase/conversations" -Method Post -ContentType $json -Headers $hh -Body (@{ propertyId = $property.id; body = "Also, is there parking?" } | ConvertTo-Json)).conversation
Check "Asking again about the same property reuses the chat" ($again.id -eq $conv.id) ""

$landlordUnread = (Invoke-RestMethod -Uri "$apiBase/conversations/unread-count" -Headers $lh).unread
Check "Landlord sees at least 2 unread" ($landlordUnread -ge 2) "(got $landlordUnread)"

$landlordList = (Invoke-RestMethod -Uri "$apiBase/conversations" -Headers $lh).conversations | Where-Object { $_.id -eq $conv.id }
Check "Landlord's inbox shows Ada Hunter, house hunter, Flat 1, 2 unread" ($landlordList.otherParty.fullName -eq "Ada Hunter" -and $landlordList.otherParty.role -eq "HUNTER" -and $landlordList.unitLabel -eq "Flat 1" -and $landlordList.unread -eq 2) "(got $($landlordList.otherParty.fullName), $($landlordList.otherParty.role), $($landlordList.unitLabel), $($landlordList.unread))"
Check "Inbox does not expose the hunter's email" ($null -eq $landlordList.otherParty.email) ""

$thread = (Invoke-RestMethod -Uri "$apiBase/conversations/$($conv.id)/messages" -Headers $lh).messages
Check "Landlord reads both messages in order, marked as not theirs" ($thread.Count -eq 2 -and $thread[0].body -like "Hello*" -and -not $thread[0].mine) "(got $($thread.Count))"
$afterRead = ((Invoke-RestMethod -Uri "$apiBase/conversations" -Headers $lh).conversations | Where-Object { $_.id -eq $conv.id }).unread
Check "Reading the thread clears its unread count" ($afterRead -eq 0) "(got $afterRead)"

$reply = (Invoke-RestMethod -Uri "$apiBase/conversations/$($conv.id)/messages" -Method Post -ContentType $json -Headers $lh -Body (@{ body = "Yes it is. You can view it on Saturday." } | ConvertTo-Json)).message
Check "Landlord replies" ($reply.mine -eq $true) ""
$newOnly = (Invoke-RestMethod -Uri "$apiBase/conversations/$($conv.id)/messages?after=$([uri]::EscapeDataString([string]$thread[-1].createdAt))" -Headers $hh).messages
Check "Polling with 'after' returns only the new reply" ($newOnly.Count -eq 1 -and $newOnly[0].body -like "Yes it is*") "(got $($newOnly.Count))"

Expect-Status "Empty message is rejected" 400 { Invoke-RestMethod -Uri "$apiBase/conversations/$($conv.id)/messages" -Method Post -ContentType $json -Headers $hh -Body (@{ body = "   " } | ConvertTo-Json) }
Expect-Status "Message over 2000 characters is rejected" 400 { Invoke-RestMethod -Uri "$apiBase/conversations/$($conv.id)/messages" -Method Post -ContentType $json -Headers $hh -Body (@{ body = ("x" * 2001) } | ConvertTo-Json) }

# --- Strangers cannot read or post ---
$stranger = Invoke-RestMethod -Uri "$apiBase/auth/register" -Method Post -ContentType $json -Body (@{ fullName = "Stranger"; email = "stranger.$suffix@example.com"; password = "StrangerPass123!"; accountType = "HUNTER" } | ConvertTo-Json)
$sh = @{ Authorization = "Bearer $($stranger.accessToken)" }
Expect-Status "Another hunter cannot read the chat" 404 { Invoke-RestMethod -Uri "$apiBase/conversations/$($conv.id)/messages" -Headers $sh }
Expect-Status "Another hunter cannot post into the chat" 404 { Invoke-RestMethod -Uri "$apiBase/conversations/$($conv.id)/messages" -Method Post -ContentType $json -Headers $sh -Body (@{ body = "hi" } | ConvertTo-Json) }

# Hidden properties cannot be messaged by people with no tenancy there.
Invoke-RestMethod -Uri "$apiBase/properties/$($property.id)" -Method Patch -ContentType $json -Headers $lh -Body (@{ isPublic = $false } | ConvertTo-Json) | Out-Null
Expect-Status "Hunter cannot start a chat about a hidden property" 404 { Invoke-RestMethod -Uri "$apiBase/conversations" -Method Post -ContentType $json -Headers $sh -Body (@{ propertyId = $property.id; body = "hi" } | ConvertTo-Json) }

# --- Hunter becomes a tenant and keeps their chat ---
$tenancy = Invoke-RestMethod -Uri "$apiBase/tenancies" -Method Post -ContentType $json -Headers $lh -Body (@{ unitId = $unit.id; tenantEmail = $hunterEmail; tenantFullName = "Ada Hunter"; startDate = (Get-Date -Format "yyyy-MM-dd") } | ConvertTo-Json)
Check "Renting to a hunter needs no invite (they already have a login)" ($null -eq $tenancy.inviteLink) "(inviteLink $($tenancy.inviteLink))"
$relogin = Invoke-RestMethod -Uri "$apiBase/auth/login" -Method Post -ContentType $json -Body (@{ email = $hunterEmail; password = "HunterPass123!" } | ConvertTo-Json)
Check "The hunter is now a tenant" ($relogin.user.role -eq "TENANT") "(got $($relogin.user.role))"
$th = @{ Authorization = "Bearer $($relogin.accessToken)" }
$tenantChats = (Invoke-RestMethod -Uri "$apiBase/conversations" -Headers $th).conversations
Check "As a tenant they still have the chat" (@($tenantChats | Where-Object { $_.id -eq $conv.id }).Count -eq 1) ""
$tenantMsg = (Invoke-RestMethod -Uri "$apiBase/conversations" -Method Post -ContentType $json -Headers $th -Body (@{ propertyId = $property.id; body = "Moved in, thank you!" } | ConvertTo-Json)).conversation
Check "Tenant can message about their (now hidden) property" ($tenantMsg.id -eq $conv.id) ""

$landlordStart = (Invoke-RestMethod -Uri "$apiBase/conversations" -Method Post -ContentType $json -Headers $lh -Body (@{ tenancyId = $tenancy.tenancy.id; body = "Welcome! Rent is due on the 1st." } | ConvertTo-Json)).conversation
Check "Landlord messaging the tenant lands in the same chat" ($landlordStart.id -eq $conv.id) ""
Expect-Status "Landlord must name a tenancy to start a chat" 400 { Invoke-RestMethod -Uri "$apiBase/conversations" -Method Post -ContentType $json -Headers $lh -Body (@{ propertyId = $property.id; body = "hi" } | ConvertTo-Json) }

# Clean up: end the tenancy so the test flat is free; the property stays hidden.
Invoke-RestMethod -Uri "$apiBase/tenancies/$($tenancy.tenancy.id)/end" -Method Post -Headers $lh | Out-Null
Write-Host "=== Done. Test property hidden from the marketplace. ==="
