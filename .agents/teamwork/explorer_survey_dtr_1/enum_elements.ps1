$pdfPath = "c:\Users\Ace\Desktop\Project\DICT Sys\dict-monitoring\scratch\pass1_dtr_signed.pdf"
Start-Process "C:\Program Files\Adobe\Acrobat DC\Acrobat\Acrobat.exe" -ArgumentList "`"$pdfPath`""
Start-Sleep -Seconds 4

Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

$root = [System.Windows.Automation.AutomationElement]::RootElement
$cond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty, "pass1_dtr_signed.pdf - Adobe Acrobat Reader (64-bit)")
$acroWin = $root.FindFirst([System.Windows.Automation.TreeScope]::Children, $cond)

if ($acroWin) {
    # Find all buttons and tree items
    $items = $acroWin.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition)
    foreach ($it in $items) {
        $cType = $it.Current.ControlType.ProgrammaticName
        $name = $it.Current.Name
        if ($cType -match "Button|TreeItem|MenuItem|Hyperlink|Text" -and $name) {
            Write-Output ("[$cType] " + $name)
        }
    }
}
Stop-Process -Name "Acrobat" -Force -ErrorAction SilentlyContinue
