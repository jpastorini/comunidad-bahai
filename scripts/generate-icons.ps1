# Generates PWA icons (192, 512, maskable 512) with a Bahá'í 9-pointed star
# on a gold gradient. Run from the repo root:
#   powershell -ExecutionPolicy Bypass -File .\scripts\generate-icons.ps1

Add-Type -AssemblyName System.Drawing

function New-StarPolygon([int]$size, [double]$pad) {
    $cx = $size / 2.0
    $cy = $size / 2.0
    $outerR = ($size / 2.0) * (1.0 - $pad)
    $innerR = $outerR * 0.49
    $pts = New-Object 'System.Drawing.PointF[]' 18
    for ($i = 0; $i -lt 9; $i++) {
        $outerAngle = [Math]::PI / 180 * ($i * 40 - 90)
        $innerAngle = [Math]::PI / 180 * ($i * 40 + 20 - 90)
        $pts[2 * $i]     = New-Object System.Drawing.PointF([float]($cx + $outerR * [Math]::Cos($outerAngle)), [float]($cy + $outerR * [Math]::Sin($outerAngle)))
        $pts[2 * $i + 1] = New-Object System.Drawing.PointF([float]($cx + $innerR * [Math]::Cos($innerAngle)), [float]($cy + $innerR * [Math]::Sin($innerAngle)))
    }
    return ,$pts
}

function New-Icon([int]$size, [string]$path, [bool]$maskable) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

    # Background — gold gradient (maskable uses full bleed; regular uses
    # a rounded square inset so the icon looks circular in iOS/Android shells).
    $rect = New-Object System.Drawing.Rectangle(0, 0, $size, $size)
    $colA = [System.Drawing.ColorTranslator]::FromHtml('#96790E')
    $colB = [System.Drawing.ColorTranslator]::FromHtml('#C4A235')
    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        $rect, $colA, $colB,
        [System.Drawing.Drawing2D.LinearGradientMode]::ForwardDiagonal
    )

    if ($maskable) {
        $g.FillRectangle($brush, $rect)
        $starPad = 0.30  # leave 80% safe area
    } else {
        # Rounded-square background
        $radius = [int]($size * 0.22)
        $path2 = New-Object System.Drawing.Drawing2D.GraphicsPath
        $d = $radius * 2
        $path2.AddArc(0, 0, $d, $d, 180, 90)
        $path2.AddArc($size - $d, 0, $d, $d, 270, 90)
        $path2.AddArc($size - $d, $size - $d, $d, $d, 0, 90)
        $path2.AddArc(0, $size - $d, $d, $d, 90, 90)
        $path2.CloseFigure()
        $g.FillPath($brush, $path2)
        $path2.Dispose()
        $starPad = 0.18
    }

    $pts = New-StarPolygon -size $size -pad $starPad
    $starBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 255, 255, 255))
    $g.FillPolygon($starBrush, $pts)

    $brush.Dispose()
    $starBrush.Dispose()
    $g.Dispose()
    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Output "Wrote $path ($size x $size)"
}

$outDir = Join-Path (Split-Path -Parent $PSScriptRoot) 'public\icons'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

New-Icon -size 192 -path (Join-Path $outDir 'icon-192.png') -maskable $false
New-Icon -size 512 -path (Join-Path $outDir 'icon-512.png') -maskable $false
New-Icon -size 512 -path (Join-Path $outDir 'icon-maskable-512.png') -maskable $true

Write-Output "Done."
