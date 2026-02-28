# PowerShell test script for scout-block hook

Write-Host "=== Testing scout-block hook ===" -ForegroundColor Cyan

# Test function
function Test-ScoutBlock {
    param(
        [string]$TestName,
        [string]$Command,
        [int]$ExpectedExit
    )

    Write-Host ""
    Write-Host "Test: $TestName"

    $input = @{
        tool_input = @{
            command = $Command
        }
    } | ConvertTo-Json -Compress

    $result = $input | node .claude/hooks/scout-block.js 2>$null
    $exitCode = $LASTEXITCODE

    if ($exitCode -eq $ExpectedExit) {
        Write-Host "✓ PASS: $TestName" -ForegroundColor Green
        return $true
    } else {
        Write-Host "✗ FAIL: $TestName (Expected exit $ExpectedExit, got $exitCode)" -ForegroundColor Red
        return $false
    }
}

# Run tests
$tests = @(
    @{Name="Allowed command (ls)"; Command="ls -la"; Expected=0},
    @{Name="Blocked - node_modules"; Command="ls node_modules"; Expected=2},
    @{Name="Blocked - .git/"; Command="cd .git/ && ls"; Expected=2},
    @{Name="Blocked - __pycache__"; Command="find __pycache__"; Expected=2},
    @{Name="Blocked - dist/"; Command="cat dist/bundle.js"; Expected=2},
    @{Name="Blocked - build/"; Command="rm -rf build/"; Expected=2},
    @{Name="Allowed - .env file"; Command="cat .env"; Expected=0}
)

$passed = 0
$failed = 0

foreach ($test in $tests) {
    if (Test-ScoutBlock -TestName $test.Name -Command $test.Command -ExpectedExit $test.Expected) {
        $passed++
    } else {
        $failed++
    }
}

Write-Host ""
Write-Host "=== Test Results ===" -ForegroundColor Cyan
Write-Host "Passed: $passed" -ForegroundColor Green
Write-Host "Failed: $failed" -ForegroundColor $(if ($failed -gt 0) { "Red" } else { "Green" })
Write-Host ""
