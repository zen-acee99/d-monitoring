$pdfPath = "c:\Users\Ace\Desktop\Project\DICT Sys\dict-monitoring\scratch\pass1_dtr_signed.pdf"
Start-Process "C:\Program Files\Adobe\Acrobat DC\Acrobat\Acrobat.exe" -ArgumentList "`"$pdfPath`""
Start-Sleep -Seconds 5
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
$windows = [System.Windows.Automation.AutomationElement]::RootElement.FindAll([System.Windows.Automation.TreeScope]::Children, [System.Windows.Automation.Condition]::TrueCondition)
foreach ($w in $windows) {
    if ($w.Current.Name -like "*Acrobat*" -or $w.Current.Name -like "*Error*" -or $w.Current.Name -like "*pass1*") {
        Write-Output ("WINDOW: " + $w.Current.Name + " | Class: " + $w.Current.ClassName)
        $children = $w.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition)
        foreach ($c in $children) {
            if ($c.Current.Name) {
                Write-Output ("   CHILD: " + $c.Current.Name + " [" + $c.Current.ControlType.ProgrammaticName + "]")
            }
        }
    }
}
Stop-Process -Name "Acrobat" -Force -ErrorAction SilentlyContinue
