#!/usr/bin/env pwsh
<#
.SYNOPSIS
  把 GitHub / Cloudflare 凭据写进 DSH profile 的 MCP 条目，或校验它们是否可用。

.DESCRIPTION
  凭据来源（优先级从高到低）：参数 > .secrets/<name>.txt > 交互输入。
  写文件前自动备份；脚本只显示 token 前后四位，不回显完整值。
  改完必须重启 harness，mcp__github__* / mcp__cloudflare__* 才会出现。

  .secrets/github.txt      第一行 GitHub PAT
  .secrets/cloudflare.txt  API Token（写两行时取最后一行，便于和 publish.ps1 共用）

  注意：本脚本刻意用 .NET 的 UTF-8 读写，而不是 Get-Content/Set-Content。
  Windows PowerShell 5.1 的 Get-Content 会把无 BOM 的 UTF-8 当 ANSI 解，
  再写回去会吃掉换行、把 profile 弄坏。这里绕开那个坑。

.EXAMPLE
  pwsh scripts/attach-mcp-tokens.ps1 -Status
  pwsh scripts/attach-mcp-tokens.ps1 -Verify
  pwsh scripts/attach-mcp-tokens.ps1
  pwsh scripts/attach-mcp-tokens.ps1 -Clear
#>
param(
  [switch]$Status,
  [switch]$Verify,
  [switch]$Clear,
  [switch]$GitHubOnly,
  [switch]$CloudflareOnly,
  [string]$GitHubToken = '',
  [string]$CloudflareToken = '',
  [string]$ProfilePath = (Join-Path $env:USERPROFILE '.dsh\profiles\desktop\cordis.patch.yml')
)

$ErrorActionPreference = 'Stop'
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch { }

$GhPlaceholder = 'ghp_PASTE_YOUR_TOKEN_HERE'
$CfPlaceholder = 'PASTE_CLOUDFLARE_API_TOKEN_HERE'
$Utf8 = New-Object System.Text.UTF8Encoding($false)

function Read-Profile {
  if (-not (Test-Path $ProfilePath)) { throw ('profile not found: ' + $ProfilePath) }
  return [System.IO.File]::ReadAllText($ProfilePath, $Utf8)
}

function Write-Profile([string]$Text) {
  [System.IO.File]::WriteAllText($ProfilePath, $Text, $Utf8)
}

function Read-Secret([string]$Name) {
  $p = Join-Path (Split-Path -Parent $PSScriptRoot) ('.secrets\' + $Name)
  if (-not (Test-Path $p)) { return '' }
  $lines = @([System.IO.File]::ReadAllLines($p, $Utf8) | ForEach-Object { $_.Trim() } | Where-Object { $_ -and -not $_.StartsWith('#') })
  if ($lines.Count -eq 0) { return '' }
  return $lines[-1]
}

function Mask([string]$v) {
  if (-not $v) { return '(empty)' }
  if ($v.Length -le 8) { return '****' }
  return $v.Substring(0, 4) + '...' + $v.Substring($v.Length - 4) + ' (len ' + $v.Length + ')'
}

function Find-Value([string[]]$Lines, [string]$Kind) {
  foreach ($line in $Lines) {
    if ($Kind -eq 'github' -and $line -match '^\s*GITHUB_PERSONAL_ACCESS_TOKEN:') {
      return ($line -split ':', 2)[1].Trim().Trim('"')
    }
    if ($Kind -eq 'cloudflare' -and $line -match '^\s*Authorization:\s*"Bearer ') {
      return (($line -split 'Bearer ', 2)[1]).Trim().TrimEnd('"')
    }
  }
  return ''
}

# ---------------------------------------------------------------- status
if ($Status) {
  $lines = Read-Profile -split "\r?\n"
  $gv = Find-Value $lines 'github'
  $fv = Find-Value $lines 'cloudflare'
  Write-Host ('profile   : ' + $ProfilePath)
  Write-Host ('github    : ' + $(if ($gv -eq $GhPlaceholder -or -not $gv) { 'PLACEHOLDER' } else { Mask $gv }))
  Write-Host ('cloudflare: ' + $(if ($fv -eq $CfPlaceholder -or -not $fv) { 'PLACEHOLDER' } else { Mask $fv }))
}

# ---------------------------------------------------------------- verify
if ($Verify) {
  $t = if ($GitHubToken) { $GitHubToken } else { Read-Secret 'github.txt' }
  if (-not $t) { $t = Find-Value (Read-Profile -split "\r?\n") 'github' }
  if ($t -and $t -ne $GhPlaceholder) {
    try {
      $me = Invoke-RestMethod -Uri 'https://api.github.com/user' -Headers @{ Authorization = 'Bearer ' + $t; 'User-Agent' = 'horizonboat' } -TimeoutSec 20
      Write-Host ('github    : OK as ' + $me.login)
    } catch {
      $code = try { [int]$_.Exception.Response.StatusCode } catch { 0 }
      Write-Host ('github    : FAILED (HTTP ' + $code + ') - token invalid / expired / missing scope')
    }
  } else { Write-Host 'github    : no token to verify' }

  $t = if ($CloudflareToken) { $CloudflareToken } else { Read-Secret 'cloudflare.txt' }
  if (-not $t) { $t = Find-Value (Read-Profile -split "\r?\n") 'cloudflare' }
  if ($t -and $t -ne $CfPlaceholder) {
    try {
      $acc = Invoke-RestMethod -Uri 'https://api.cloudflare.com/client/v4/accounts' -Headers @{ Authorization = 'Bearer ' + $t } -TimeoutSec 20
      $names = @($acc.result | ForEach-Object { $_.name }) -join ', '
      Write-Host ('cloudflare: OK, ' + @($acc.result).Count + ' account(s): ' + $names)
    } catch {
      $code = try { [int]$_.Exception.Response.StatusCode } catch { 0 }
      Write-Host ('cloudflare: FAILED (HTTP ' + $code + ') - token invalid or lacks Account read')
    }
  } else { Write-Host 'cloudflare: no token to verify' }
}

if ($Status -or $Verify) { exit 0 }

# ---------------------------------------------------------------- write / clear
$raw = Read-Profile
$nl = if ($raw.Contains([string][char]13 + [string][char]10)) { [string][char]13 + [string][char]10 } else { [string][char]10 }
$lines = @($raw -split "\r?\n")

$gh = if ($GitHubToken) { $GitHubToken } else { Read-Secret 'github.txt' }
$cf = if ($CloudflareToken) { $CloudflareToken } else { Read-Secret 'cloudflare.txt' }
if ($GitHubOnly) { $cf = '' }
if ($CloudflareOnly) { $gh = '' }

if ($Clear) {
  $gh = $GhPlaceholder
  $cf = $CfPlaceholder
} elseif (-not $gh -and -not $cf) {
  throw 'no token supplied (put one in .secrets/ or pass -GitHubToken/-CloudflareToken)'
}

$backup = $ProfilePath + '.bak-token-' + (Get-Date -Format yyyyMMddHHmmss)
Copy-Item $ProfilePath $backup -Force

$changed = 0
for ($i = 0; $i -lt $lines.Count; $i++) {
  if ($gh -and $lines[$i] -match '^\s*GITHUB_PERSONAL_ACCESS_TOKEN:') {
    $indent = ([regex]::Match($lines[$i], '^\s*')).Value
    $lines[$i] = $indent + 'GITHUB_PERSONAL_ACCESS_TOKEN: "' + $gh + '"'
    $changed++
  }
  elseif ($cf -and $lines[$i] -match '^\s*Authorization:\s*"Bearer ') {
    $indent = ([regex]::Match($lines[$i], '^\s*')).Value
    $lines[$i] = $indent + 'Authorization: "Bearer ' + $cf + '"'
    $changed++
  }
}

if ($changed -eq 0) { throw 'no matching lines found in profile' }

Write-Profile ($lines -join $nl)
Write-Host ('profile   : ' + $ProfilePath)
Write-Host ('backup    : ' + (Split-Path -Leaf $backup))
Write-Host ('lines     : ' + $changed + ' updated')
if ($gh) { Write-Host ('github    : ' + $(if ($Clear) { 'placeholder restored' } else { Mask $gh })) }
if ($cf) { Write-Host ('cloudflare: ' + $(if ($Clear) { 'placeholder restored' } else { Mask $cf })) }
Write-Host 'next      : restart the harness; tools appear as mcp__github__* / mcp__cloudflare__*'
