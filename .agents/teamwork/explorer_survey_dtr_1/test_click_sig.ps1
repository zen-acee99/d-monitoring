$pdfPath = "c:\Users\Ace\Desktop\Project\DICT Sys\dict-monitoring\scratch\pass1_dtr_signed.pdf"
Start-Process "C:\Program Files\Adobe\Acrobat DC\Acrobat\Acrobat.exe" -ArgumentList "`"$pdfPath`""
Start-Sleep -Seconds 4

Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -AssemblyName System.Windows.Forms

# Find the Acrobat window
$root = [System.Windows.Automation.AutomationElement]::RootElement
$cond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty, "pass1_dtr_signed.pdf - Adobe Acrobat Reader (64-bit)")
$acroWin = $root.FindFirst([System.Windows.Automation.TreeScope]::Children, $cond)

if ($acroWin) {
    Write-Output "Found Acrobat window!"
    
    # Look for button "Signature Panel"
    $btnCond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty, "Signature Panel")
    $sigBtn = $acroWin.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $btnCond)
    if ($sigBtn) {
        Write-Output "Found Signature Panel button, clicking it..."
        $invokePattern = $sigBtn.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)
        $invokePattern.Invoke()
        Start-Sleep -Seconds 2
    }
    
    # Check if any dialog opened
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
} else {
    Write-Output "Could not find Acrobat window."
}

Stop-Process -Name "Acrobat" -Force -ErrorAction SilentlyContinue
