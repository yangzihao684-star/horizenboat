#!/usr/bin/env pwsh
<#
.SYNOPSIS
  HorizenBoat 一键发布：GitHub 建仓推送 / Cloudflare Pages 部署 / PyPI 发包。

.DESCRIPTION
  凭据只从 .secrets/ 读取（该目录已被 .gitignore 忽略），脚本不会打印任何 token。
    .secrets/github.txt      单个 GitHub PAT（fine-grained 需要 Contents: RW + Administration: RW + Workflows: RW）
    .secrets/cloudflare.txt  两行：第一行 account_id，第二行 API Token；或只写一行 token（脚本自行查账号）
    .secrets/pypi.txt        PyPI API token（pypi-...）

.EXAMPLE
  pwsh scripts/publish.ps1 -Step status
  pwsh scripts/publish.ps1 -Step github -DryRun
  pwsh scripts/publish.ps1 -Step cloudflare
#>
param(
  [ValidateSet('status', 'github', 'cloudflare', 'pypi', 'zones')]
  [string]$Step = 'status',
  [string]$RepoName = 'horizenboat',
  [string]$ProjectName = 'horizenboat',
  [string]$Domain = 'horizenboat.online',
  [switch]$Private,
  [switch]$Force,
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch { }

$Root = Split-Path -Parent $PSScriptRoot
$Secrets = Join-Path $Root '.secrets'

function Read-Secret([string]$Name) {
  $path = Join-Path $Secrets $Name
  if (-not (Test-Path $path)) { return @() }
  return @(Get-Content $path | ForEach-Object { $_.Trim() } | Where-Object { $_ -and -not $_.StartsWith('#') })
}

function Show-Status {
  Write-Host 'HorizenBoat publish status' -ForegroundColor Cyan
  Write-Host ('  repo root : ' + $Root)

  $sizes = @{}
  foreach ($f in @('github.txt', 'cloudflare.txt', 'pypi.txt')) {
    $p = Join-Path $Secrets $f
    $sizes[$f] = if (Test-Path $p) { (Get-Item $p).Length } else { 0 }
  }
  foreach ($f in $sizes.Keys | Sort-Object) {
    $state = if ($sizes[$f] -gt 0) { 'present' } else { 'missing' }
    Write-Host ('  secret    : ' + $f.PadRight(16) + $state)
  }

  $branch = (git -C $Root branch --show-current)
  $dirty = (git -C $Root status --porcelain)
  Write-Host ('  git       : branch=' + $branch + '  changes=' + $(if ($dirty) { 'yes' } else { 'none' }))
  $remotes = @(git -C $Root remote 2>$null)
  $remote = if ($remotes -contains 'origin') { (git -C $Root remote get-url origin 2>$null) } else { $null }
  Write-Host ('  origin    : ' + $(if ($remote) { $remote } else { '(not set)' }))
  $dist = Join-Path $Root 'web/dist/index.html'
  Write-Host ('  build     : ' + $(if (Test-Path $dist) { 'web/dist ready' } else { 'run npm run build first' }))
  $whl = Get-ChildItem (Join-Path $Root 'mcp-server/dist/*.whl') -ErrorAction SilentlyContinue | Select-Object -First 1
  Write-Host ('  wheel     : ' + $(if ($whl) { $whl.Name } else { '(not built)' }))
}

function Step-GitHub {
  $token = @(Read-Secret 'github.txt') | Select-Object -First 1
  if (-not $token) { throw 'missing .secrets/github.txt' }

  $headers = @{
    Authorization = 'Bearer ' + $token
    Accept        = 'application/vnd.github+json'
    'User-Agent'  = 'horizenboat-publish'
    'X-GitHub-Api-Version' = '2022-11-28'
  }

  $me = Invoke-RestMethod -Uri 'https://api.github.com/user' -Headers $headers
  $full = $me.login + '/' + $RepoName
  Write-Host ('  account   : ' + $me.login)
  Write-Host ('  target    : ' + $full)

  $exists = $true
  try { Invoke-RestMethod -Uri ('https://api.github.com/repos/' + $full) -Headers $headers | Out-Null }
  catch { $exists = $false }

  if ($exists) {
    Write-Host '  repo      : already exists, skip create'
  } elseif ($DryRun) {
    Write-Host '  [dry-run] POST https://api.github.com/user/repos  name=' + $RepoName + ' private=' + [bool]$Private
  } else {
    $body = @{
      name        = $RepoName
      private     = [bool]$Private
      description = 'HorizenBoat - canon-locked fanwork library + MCP server'
      homepage    = 'https://' + $Domain
    } | ConvertTo-Json
    Invoke-RestMethod -Uri 'https://api.github.com/user/repos' -Method Post -Headers $headers -Body $body -ContentType 'application/json' | Out-Null
    Write-Host '  repo      : created'
  }

  $remoteUrl = 'https://github.com/' + $full + '.git'
  $remotes = @(git -C $Root remote 2>$null)
  $current = if ($remotes -contains 'origin') { (git -C $Root remote get-url origin 2>$null) } else { $null }
  if ($DryRun) {
    Write-Host ('  [dry-run] git remote set-url origin ' + $remoteUrl)
    Write-Host '  [dry-run] git push origin HEAD:main'
    return
  }
  if ($current) { git -C $Root remote set-url origin $remoteUrl } else { git -C $Root remote add origin $remoteUrl }

  # 用一次性 extraheader 推，避免把 token 写进 .git/config
  $basic = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes('x-access-token:' + $token))
  $pushArgs = @('-C', $Root, '-c', ('http.extraheader=AUTHORIZATION: basic ' + $basic), 'push', '-u', 'origin', 'HEAD:main')
  if ($Force) {
    $pushArgs += '--force'
    Write-Host '  force     : enabled, remote history will be replaced'
  }
  & git @pushArgs
  if ($LASTEXITCODE -ne 0) {
    throw 'git push failed: PAT 缺少 Contents/Workflows 读写，或远端已有无关历史（加 -Force）'
  }
  Write-Host ('  pushed    : ' + $remoteUrl)
}

function Step-Cloudflare {
  $lines = @(Read-Secret 'cloudflare.txt')
  if ($lines.Count -eq 0) { throw 'missing .secrets/cloudflare.txt' }

  if ($lines.Count -ge 2) { $accountId = $lines[0]; $cfToken = $lines[1] } else { $accountId = $null; $cfToken = $lines[0] }
  $headers = @{ Authorization = 'Bearer ' + $cfToken }

  if (-not $accountId) {
    $accounts = Invoke-RestMethod -Uri 'https://api.cloudflare.com/client/v4/accounts' -Headers $headers
    if (-not $accounts.result -or $accounts.result.Count -eq 0) { throw 'token cannot see any account' }
    $accountId = $accounts.result[0].id
  }
  Write-Host ('  account   : ' + $accountId)

  $projectUrl = 'https://api.cloudflare.com/client/v4/accounts/' + $accountId + '/pages/projects/' + $ProjectName
  $exists = $true
  try { Invoke-RestMethod -Uri $projectUrl -Headers $headers | Out-Null } catch { $exists = $false }

  if ($exists) {
    Write-Host '  project   : exists'
  } elseif ($DryRun) {
    Write-Host ('  [dry-run] POST /accounts/' + $accountId + '/pages/projects  name=' + $ProjectName)
  } else {
    $body = @{ name = $ProjectName; production_branch = 'main' } | ConvertTo-Json
    Invoke-RestMethod -Uri ('https://api.cloudflare.com/client/v4/accounts/' + $accountId + '/pages/projects') -Method Post -Headers $headers -Body $body -ContentType 'application/json' | Out-Null
    Write-Host '  project   : created (direct upload mode)'
  }

  $dist = Join-Path $Root 'web/dist'
  if (-not (Test-Path (Join-Path $dist 'index.html'))) { throw 'web/dist missing, run: npm --prefix web run build' }

  if ($DryRun) {
    Write-Host ('  [dry-run] wrangler pages deploy ' + $dist + ' --project-name ' + $ProjectName)
    return
  }

  $env:CLOUDFLARE_API_TOKEN = $cfToken
  $env:CLOUDFLARE_ACCOUNT_ID = $accountId
  Push-Location $Root
  try {
    npx --yes wrangler@latest pages deploy $dist --project-name $ProjectName --branch main --commit-dirty=true
    if ($LASTEXITCODE -ne 0) { throw 'wrangler deploy failed' }
  } finally { Pop-Location }

  Write-Host ('  url       : https://' + $ProjectName + '.pages.dev')

  # 绑定自定义域名：需要 token 有 Zone:Read + DNS:Edit，且域名托管在同一账号
  if ($Domain) {
    $zones = $null
    try {
      $zones = Invoke-RestMethod -Uri ('https://api.cloudflare.com/client/v4/zones?per_page=100') -Headers $headers
    } catch { }

    if (-not $zones -or @($zones.result).Count -eq 0) {
      Write-Host ('  domain    : SKIPPED - token cannot list zones (add Zone:Read + DNS:Edit)')
      Write-Host ('              or bind manually: Pages -> ' + $ProjectName + ' -> Custom domains -> ' + $Domain)
      return
    }

    $zone = @($zones.result) | Where-Object { $Domain -eq $_.name -or $Domain.EndsWith('.' + $_.name) } | Select-Object -First 1
    if (-not $zone) {
      Write-Host ('  domain    : SKIPPED - ' + $Domain + ' is not in this account. Zones: ' + ((@($zones.result) | ForEach-Object { $_.name }) -join ', '))
      return
    }

    Write-Host ('  zone      : ' + $zone.name + ' (' + $zone.id + ')')
    if ($DryRun) { Write-Host ('  [dry-run] POST ' + $projectUrl + '/domains  name=' + $Domain); return }

    try {
      $existing = Invoke-RestMethod -Uri ($projectUrl + '/domains') -Headers $headers
      $already = @($existing.result) | Where-Object { $_.name -eq $Domain }
      if ($already) {
        Write-Host ('  domain    : already attached (status ' + $already.status + ')')
      } else {
        $dbody = @{ name = $Domain } | ConvertTo-Json
        $added = Invoke-RestMethod -Uri ($projectUrl + '/domains') -Method Post -Headers $headers -Body $dbody -ContentType 'application/json'
        Write-Host ('  domain    : attached ' + $Domain + ' (status ' + $added.result.status + ')')
      }
      Write-Host ('  live      : https://' + $Domain)
    } catch {
      $msg = $_.Exception.Message
      Write-Host ('  domain    : FAILED - ' + $msg)
      Write-Host ('              fallback: Pages -> Custom domains -> ' + $Domain)
    }
  }
}

function Step-PyPI {
  $token = @(Read-Secret 'pypi.txt') | Select-Object -First 1
  if (-not $token) { throw 'missing .secrets/pypi.txt' }

  Push-Location (Join-Path $Root 'mcp-server')
  try {
    if ($DryRun) {
      Write-Host '  [dry-run] uv build'
      Write-Host '  [dry-run] uv publish --token ***'
      return
    }
    uv build
    if ($LASTEXITCODE -ne 0) { throw 'uv build failed' }

    $meta = (Get-Content pyproject.toml | Select-String -Pattern '^version' | Select-Object -First 1).Line
    Write-Host ('  version   : ' + $meta.Trim())
    $answer = Read-Host 'publish to PyPI? type yes to continue'
    if ($answer -ne 'yes') { Write-Host '  aborted'; return }

    $env:UV_PUBLISH_TOKEN = $token
    uv publish
    if ($LASTEXITCODE -ne 0) { throw 'uv publish failed' }
    Write-Host '  published : https://pypi.org/project/horizenboat-mcp/'
  } finally {
    Remove-Item Env:UV_PUBLISH_TOKEN -ErrorAction SilentlyContinue
    Pop-Location
  }
}

function Step-Zones {
  $lines = @(Read-Secret 'cloudflare.txt')
  if ($lines.Count -eq 0) { throw 'missing .secrets/cloudflare.txt' }
  if ($lines.Count -ge 2) { $accountId = $lines[0]; $cfToken = $lines[1] } else { $accountId = $null; $cfToken = $lines[0] }
  $headers = @{ Authorization = 'Bearer ' + $cfToken }

  $accounts = Invoke-RestMethod -Uri 'https://api.cloudflare.com/client/v4/accounts' -Headers $headers
  Write-Host ('accounts  : ' + @($accounts.result).Count)
  @($accounts.result) | ForEach-Object { Write-Host ('  ' + $_.id + '  ' + $_.name) }

  $zones = Invoke-RestMethod -Uri 'https://api.cloudflare.com/client/v4/zones?per_page=100' -Headers $headers
  $count = @($zones.result).Count
  Write-Host ('zones     : ' + $count)
  @($zones.result) | ForEach-Object { Write-Host ('  ' + $_.name + '  [' + $_.status + ']  ' + $_.id) }

  if ($count -eq 0) {
    Write-Host ''
    Write-Host '  0 zones means the token cannot see any zone. Either it lacks Zone:Read,'
    Write-Host '  or the domain lives in a different Cloudflare account than the one above.'
  }
}

switch ($Step) {
  'status'     { Show-Status }
  'github'     { Step-GitHub }
  'cloudflare' { Step-Cloudflare }
  'pypi'       { Step-PyPI }
  'zones'      { Step-Zones }
}
