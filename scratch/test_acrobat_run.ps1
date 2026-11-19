$acrobatPath = "C:\Program Files\Adobe\Acrobat DC\Acrobat\Acrobat.exe"
$pdfPath = "C:\Users\Ace\Desktop\Project\DICT Sys\dict-monitoring\scratch\live_api_pass2.pdf"

$proc = Start-Process -FilePath $acrobatPath -ArgumentList "`"$pdfPath`"" -PassThru
Start-Sleep -Seconds 4

$windows = Get-Process | Where-Object { $_.MainWindowTitle -ne '' -and $_.ProcessName -like '*Acro*' }
Write-Host "Acrobat Windows:"
foreach ($w in $windows) {
    Write-Host "  $($w.ProcessName) [PID $($w.Id)]: $($w.MainWindowTitle)"
}

Stop-Process -Id $proc.Id -Force
Write-Host "Done validating live API generated PDF in Adobe Acrobat!"
