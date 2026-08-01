$ErrorActionPreference = 'Stop'

$nodes = Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'next dev' -or $_.CommandLine -match 'next-server' }
if ($nodes) {
  foreach ($node in $nodes) {
    Stop-Process -Id $node.ProcessId -Force
    Write-Host "Stopped process $($node.ProcessId)"
  }
} else {
  Write-Host 'No matching dev server process found.'
}
