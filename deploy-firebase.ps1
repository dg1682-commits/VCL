# =========================================================
# VCL-Light Firebase Deploy Script
# (주)일신비츠온 VCL-Light Firebase Hosting 배포 자동화
# =========================================================

Write-Host "=========================================================" -ForegroundColor Cyan
Write-Host "  VCL-Light Firebase Hosting 배포를 시작합니다..." -ForegroundColor Green
Write-Host "  Project ID: vcl-light" -ForegroundColor Yellow
Write-Host "=========================================================" -ForegroundColor Cyan

# 1. Check if firebase CLI exists or use npx
$hasFirebase = (Get-Command firebase -ErrorAction SilentlyContinue) -ne $null

if ($hasFirebase) {
    Write-Host "[1/2] Firebase CLI 발견. 배포 진행 중..." -ForegroundColor Gray
    firebase deploy --only hosting,firestore
} else {
    Write-Host "[1/2] npx를 통해 최신 firebase-tools 실행..." -ForegroundColor Gray
    npx -y firebase-tools@latest deploy --only hosting,firestore
}

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "=========================================================" -ForegroundColor Green
    Write-Host "  배포 완료!" -ForegroundColor Green
    Write-Host "  접속 URL: https://vcl-light.web.app" -ForegroundColor Cyan
    Write-Host "  또는:     https://vcl-light.firebaseapp.com" -ForegroundColor Cyan
    Write-Host "=========================================================" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "[안내] Firebase 배포 중 로그인이 필요할 수 있습니다." -ForegroundColor Yellow
    Write-Host "일반 터미널(CMD 또는 PowerShell)에서 아래 명령어를 실행해주세요:" -ForegroundColor White
    Write-Host "  1) npx -y firebase-tools login" -ForegroundColor Cyan
    Write-Host "  2) npx -y firebase-tools deploy" -ForegroundColor Cyan
}
