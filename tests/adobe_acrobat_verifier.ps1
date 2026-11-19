param(
    [Parameter(Mandatory=$true)]
    [string]$PdfPath,
    [int]$WaitSeconds = 6
)

Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

$acrobatPath = "C:\Program Files\Adobe\Acrobat DC\Acrobat\Acrobat.exe"
if (-not (Test-Path $acrobatPath)) {
    Write-Error "Acrobat not found at $acrobatPath"
    exit 1
}

$resolvedPdfPath = (Resolve-Path $PdfPath).Path
Write-Host "Opening PDF in Acrobat: $resolvedPdfPath"

# Terminate any existing Acrobat instances first to ensure fresh launch
Get-Process -Name "Acrobat" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 500

$proc = Start-Process -FilePath $acrobatPath -ArgumentList "`"$resolvedPdfPath`"" -PassThru

Write-Host "Waiting $WaitSeconds seconds for Acrobat to initialize and verify signatures..."
Start-Sleep -Seconds $WaitSeconds

$acrobatProcs = Get-Process -Name "Acrobat" -ErrorAction SilentlyContinue
$pids = @($acrobatProcs | ForEach-Object { $_.Id })
Write-Host "Active Acrobat PIDs: $($pids -join ', ')"

$root = [System.Windows.Automation.AutomationElement]::RootElement

$foundError = $false
$errorDetails = @()
$windowSummaries = @()

# Search all top-level windows belonging to any Acrobat PID
foreach ($p in $pids) {
    $procCondition = New-Object System.Windows.Automation.PropertyCondition(
        [System.Windows.Automation.AutomationElement]::ProcessIdProperty,
        $p
    )

    $windows = $root.FindAll(
        [System.Windows.Automation.TreeScope]::Children,
        $procCondition
    )

    foreach ($win in $windows) {
        $winName = $win.Current.Name
        $winClassName = $win.Current.ClassName
        Write-Host "  Window (PID $p): '$winName' (Class: $winClassName)"
        $windowSummaries += "[$p] $winName ($winClassName)"

        # Inspect all descendants of this window
        $allElements = $win.FindAll(
            [System.Windows.Automation.TreeScope]::Descendants,
            [System.Windows.Automation.Condition]::TrueCondition
        )

        foreach ($el in $allElements) {
            $name = $el.Current.Name
            $help = $el.Current.HelpText
            $cType = $el.Current.ControlType.ProgrammaticName

            if ($name -match "Expected a dict object" -or $name -match "Error during signature verification" -or $name -match "Adobe Acrobat error") {
                $foundError = $true
                $errorDetails += "FATAL ERROR DETECTED in element ($cType): $name"
                Write-Host ">>> FATAL ERROR MATCH: $name" -ForegroundColor Red
            } elseif ($name -match "Error" -and ($winClassName -match "Dialog|#32770" -or $cType -match "Text|TitleBar")) {
                $foundError = $true
                $errorDetails += "Dialog Error ($cType): $name"
                Write-Host ">>> DIALOG ERROR: $name" -ForegroundColor Red
            }
        }
    }
}

# Also check for any top-level dialog windows (#32770) that might be orphaned or modal to the desktop
$dialogCondition = New-Object System.Windows.Automation.PropertyCondition(
    [System.Windows.Automation.AutomationElement]::ClassNameProperty,
    "#32770"
)
$dialogs = $root.FindAll([System.Windows.Automation.TreeScope]::Children, $dialogCondition)
foreach ($dlg in $dialogs) {
    $dlgPid = $dlg.Current.ProcessId
    if ($pids -contains $dlgPid) {
        $dlgName = $dlg.Current.Name
        Write-Host "  Detected Modal Dialog (PID $dlgPid): '$dlgName'"
        $elements = $dlg.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition)
        foreach ($el in $elements) {
            $text = $el.Current.Name
            if ($text) {
                Write-Host "    Dialog item: $text"
                if ($text -match "Expected a dict object" -or $text -match "Error during signature verification") {
                    $foundError = $true
                    $errorDetails += "MODAL POPUP ERROR: $text"
                }
            }
        }
    }
}

# Cleanly close Acrobat
Write-Host "Closing Acrobat processes..."
Get-Process -Name "Acrobat" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

Write-Host "=== VERIFICATION RESULT ==="
Write-Host "PDF: $resolvedPdfPath"
Write-Host "Window Count: $($windowSummaries.Count)"
Write-Host "Windows: $($windowSummaries -join ' | ')"
Write-Host "Fatal Modal Detected: $foundError"
if ($errorDetails.Count -gt 0) {
    Write-Host "Errors:" ($errorDetails -join "; ")
} else {
    Write-Host "SUCCESS: No signature verification modal errors detected. Document verified cleanly in Adobe Acrobat."
}

if ($foundError) {
    exit 2
} else {
    exit 0
}
