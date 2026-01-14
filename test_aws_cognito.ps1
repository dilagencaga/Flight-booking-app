$ErrorActionPreference = "Stop"

function Test-Endpoint {
    param($Port)
    $baseUrl = "http://localhost:$Port"
    $rand = Get-Random
    $email = "test.cognito.$rand@example.com"
    $password = "TestPassword123!"

    Write-Host "--------------------------------------------------"
    Write-Host "Testing Target: $baseUrl" -ForegroundColor Cyan
    Write-Host "--------------------------------------------------"

    # 1. Register
    Write-Host "[1] Registering User: $email..."
    $regBody = @{
        firstName = "Test"
        lastName = "User"
        email = $email
        password = $password
        dob = "1990-01-01"
    } | ConvertTo-Json

    try {
        $regResponse = Invoke-RestMethod -Method Post -Uri "$baseUrl/v1/auth/register" -Body $regBody -ContentType "application/json"
        Write-Host "SUCCESS: User Registered." -ForegroundColor Green
        Write-Host "Response: $($regResponse | ConvertTo-Json -Depth 2)"
    } catch {
        Write-Host "FAILED: Register failed." -ForegroundColor Red
        Write-Host "Error: $($_.Exception.Message)"
        if ($_.Exception.Response) {
             # Write-Host "Server Response: " -NoNewline
             # $_.Exception.Response.GetResponseStream() | %{ [System.IO.StreamReader]::new($_).ReadToEnd() }
        }
        return $false
    }

    # 2. Login
    Write-Host "`n[2] Logging in User: $email..."
    $loginBody = @{
        email = $email
        password = $password
    } | ConvertTo-Json

    try {
        $loginResponse = Invoke-RestMethod -Method Post -Uri "$baseUrl/v1/auth/login" -Body $loginBody -ContentType "application/json"
        Write-Host "SUCCESS: User Logged In." -ForegroundColor Green
        if ($loginResponse.token) {
            Write-Host "Token received (truncated): $($loginResponse.token.Substring(0, 10))..."
        }
        Write-Host "Full Response: $($loginResponse | ConvertTo-Json -Depth 2)"
        return $true
    } catch {
        Write-Host "FAILED: Login failed." -ForegroundColor Red
        Write-Host "Error: $($_.Exception.Message)"
        if ($_.Exception.Message -match "UserNotConfirmedException") {
            Write-Host "NOTE: User is not confirmed. Please confirm in AWS Console or check email." -ForegroundColor Yellow
        }
        return $false
    }
}

Write-Host "Starting AWS Cognito Verification Script...`n"

# Try Gateway first
$success = Test-Endpoint -Port 3000
if (-not $success) {
    Write-Host "`nGateway (3000) failed or not reachable. Trying Direct Service (3001)..." -ForegroundColor Yellow
    Test-Endpoint -Port 3001
}

Write-Host "`nDONE."
