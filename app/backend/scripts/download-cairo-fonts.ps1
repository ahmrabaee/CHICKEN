# Download Cairo fonts from Google Fonts for proper Arabic PDF rendering
# Run: .\scripts\download-cairo-fonts.ps1
$fontDir = Join-Path (Split-Path $PSScriptRoot -Parent) "src\pdf\fonts"
$urls = @{
    "Cairo-Regular.ttf" = "https://github.com/google/fonts/raw/main/ofl/cairo/static/Cairo-Regular.ttf"
    "Cairo-Bold.ttf"     = "https://github.com/google/fonts/raw/main/ofl/cairo/static/Cairo-Bold.ttf"
}
New-Item -ItemType Directory -Force -Path $fontDir | Out-Null
foreach ($file in $urls.Keys) {
    $out = Join-Path $fontDir $file
    Write-Host "Downloading $file..."
    Invoke-WebRequest -Uri $urls[$file] -OutFile $out -UseBasicParsing
    Write-Host "  -> $out"
}
Write-Host "Done. Rebuild: npm run build"
