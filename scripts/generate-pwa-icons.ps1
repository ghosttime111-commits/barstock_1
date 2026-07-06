param(
  [string]$OutputDirectory = (Join-Path $PSScriptRoot "..\public")
)

Add-Type -AssemblyName System.Drawing

$outputPath = [System.IO.Path]::GetFullPath($OutputDirectory)
[System.IO.Directory]::CreateDirectory($outputPath) | Out-Null

function New-BarStockIcon {
  param(
    [int]$Size,
    [string]$FileName,
    [bool]$Maskable = $false
  )

  $bitmap = [System.Drawing.Bitmap]::new($Size, $Size)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml("#17130f"))

  $scale = if ($Maskable) { 0.68 } else { 0.82 }
  $offset = ($Size * (1 - $scale)) / 2
  $orange = [System.Drawing.ColorTranslator]::FromHtml("#f5a524")
  $mutedOrange = [System.Drawing.ColorTranslator]::FromHtml("#c97b16")
  $penWidth = [Math]::Max(2, $Size * 0.055 * $scale)

  $pen = [System.Drawing.Pen]::new($orange, $penWidth)
  $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round

  $accentPen = [System.Drawing.Pen]::new($mutedOrange, [Math]::Max(1.5, $penWidth * 0.55))
  $accentPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $accentPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round

  function X([double]$value) { return [single]($offset + $value * $Size * $scale) }
  function Y([double]$value) { return [single]($offset + $value * $Size * $scale) }

  $bowl = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $bowl.StartFigure()
  $bowl.AddBezier(
    (X 0.26), (Y 0.22),
    (X 0.27), (Y 0.47),
    (X 0.34), (Y 0.59),
    (X 0.50), (Y 0.60)
  )
  $bowl.AddBezier(
    (X 0.50), (Y 0.60),
    (X 0.66), (Y 0.59),
    (X 0.73), (Y 0.47),
    (X 0.74), (Y 0.22)
  )
  $graphics.DrawPath($pen, $bowl)
  $graphics.DrawLine($pen, (X 0.26), (Y 0.22), (X 0.74), (Y 0.22))
  $graphics.DrawLine($accentPen, (X 0.32), (Y 0.42), (X 0.68), (Y 0.42))
  $graphics.DrawLine($pen, (X 0.50), (Y 0.60), (X 0.50), (Y 0.78))
  $graphics.DrawLine($pen, (X 0.35), (Y 0.80), (X 0.65), (Y 0.80))

  $bowl.Dispose()
  $accentPen.Dispose()
  $pen.Dispose()
  $graphics.Dispose()

  $target = Join-Path $outputPath $FileName
  $bitmap.Save($target, [System.Drawing.Imaging.ImageFormat]::Png)
  $bitmap.Dispose()
}

New-BarStockIcon -Size 32 -FileName "favicon-32x32.png"
New-BarStockIcon -Size 180 -FileName "apple-touch-icon.png"
New-BarStockIcon -Size 192 -FileName "pwa-192x192.png"
New-BarStockIcon -Size 512 -FileName "pwa-512x512.png"
New-BarStockIcon -Size 512 -FileName "pwa-maskable-512x512.png" -Maskable $true

Write-Host "PWA icons generated in $outputPath"
