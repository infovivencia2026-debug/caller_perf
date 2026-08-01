$ErrorActionPreference = 'Stop'

$proc = Start-Process -PassThru -FilePath "npm" -ArgumentList "run dev" -WorkingDirectory $PSScriptRoot/..
Write-Host "Started development server (PID: $($proc.Id))"
