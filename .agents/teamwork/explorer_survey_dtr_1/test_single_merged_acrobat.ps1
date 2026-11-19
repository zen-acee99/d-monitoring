$pdfPath = "c:\Users\Ace\Desktop\Project\DICT Sys\dict-monitoring\scratch\test_single_merged.pdf"
Start-Process "C:\Program Files\Adobe\Acrobat DC\Acrobat\Acrobat.exe" -ArgumentList "`"$pdfPath`""
Start-Sleep -Seconds 5

Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

$root = [System.Windows.Automation.AutomationElement]::RootElement
$dialogs = $root.FindAll([System.Windows.Automation.TreeScope]::Children, [System.Windows.Automation.Condition]::TrueCondition)

foreach ($d in $dialogs) {
    $name = $d.Current.Name
    if ($name -like "*Error*" -or $name -like "*Adobe Acrobat*") {
        Write-Output ("DETECTED DIALOG: " + $name)
        $descs = $d.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition)
        foreach ($item in $descs) {
            if ($item.Current.Name) {
                Write-Output ("   " + $item.Current.Name)
            }
        }
    }
}

Stop-Process -Name "Acrobat" -Force -ErrorAction SilentlyContinue
