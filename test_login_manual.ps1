$ErrorActionPreference = "Stop"

$baseUrl = "http://localhost:3000"

Write-Host "LOG IN TEST (Manuel)" -ForegroundColor Cyan
$email = Read-Host "Lutfen AWS'de onayladiginiz Email adresini yapistirin"
$password = "TestPassword123!" 
# Not: Eger scriptteki sifreyi degistirmediyseniz standart sifre budur.

Write-Host "`nLogging in User: $email..."
$loginBody = @{
    email = $email
    password = $password
} | ConvertTo-Json

try {
    $loginResponse = Invoke-RestMethod -Method Post -Uri "$baseUrl/v1/auth/login" -Body $loginBody -ContentType "application/json"
    Write-Host "SUCCESS: User Logged In!" -ForegroundColor Green
    Write-Host "Token: $($loginResponse.token.Substring(0, 10))..."
    Write-Host "Full Response: $($loginResponse | ConvertTo-Json -Depth 2)"
} catch {
    Write-Host "FAILED: Login failed." -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)"
    if ($_.Exception.Message -match "UserNotConfirmedException") {
        Write-Host "NOTE: User is NOT confirmed." -ForegroundColor Yellow
    }
}
