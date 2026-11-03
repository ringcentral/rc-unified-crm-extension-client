<#
.SYNOPSIS
  Updates public/embeddable with the latest ringcentral-embeddable extension build.

.DESCRIPTION
  1. Switches this repo to the beta branch
  2. Downloads the zip of ringcentral-embeddable branch 3.1.x-extension-build
  3. Extracts it over public/embeddable (overwriting existing files)
  4. Deletes public/embeddable/index.html
#>
param(
  [string]$Branch = 'beta',
  [string]$EmbeddableBranch = '3.1.x-extension-build',
  [string]$ZipUrl = "https://github.com/ringcentral/ringcentral-embeddable/archive/refs/heads/$EmbeddableBranch.zip"
)

$ErrorActionPreference = 'Stop'

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$Target = Join-Path $RepoRoot 'public\embeddable'
$Work = Join-Path ([System.IO.Path]::GetTempPath()) ("embeddable-" + [guid]::NewGuid())

New-Item -ItemType Directory -Path $Work | Out-Null
try {
  Write-Host "Switching to $Branch..."
  git -C $RepoRoot checkout $Branch
  if ($LASTEXITCODE -ne 0) { throw "git checkout $Branch failed" }

  $Zip = Join-Path $Work 'embeddable.zip'
  $Extracted = Join-Path $Work 'extracted'
  Write-Host "Downloading $ZipUrl..."
  Invoke-WebRequest -Uri $ZipUrl -OutFile $Zip -UseBasicParsing
  Expand-Archive -Path $Zip -DestinationPath $Extracted

  # GitHub zips contain a single top-level folder; copy its contents.
  $Root = Get-ChildItem -Path $Extracted -Directory | Select-Object -First 1
  if (-not $Root) { throw 'Unexpected zip layout: no top-level folder' }

  New-Item -ItemType Directory -Force -Path $Target | Out-Null
  Write-Host "Copying into $Target..."
  Copy-Item -Path (Join-Path $Root.FullName '*') -Destination $Target -Recurse -Force

  $Index = Join-Path $Target 'index.html'
  if (Test-Path $Index) {
    Remove-Item $Index -Force
    Write-Host 'Removed index.html'
  }
  Write-Host 'Done.'
}
finally {
  Remove-Item -Path $Work -Recurse -Force -ErrorAction SilentlyContinue
}
