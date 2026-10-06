# scripts/lint-md-tables.ps1
# Linter for Markdown tables across the project

param(
    [string]$Path = "."
)

$ErrorCount = 0
$WarningCount = 0
$FilesChecked = 0

function Count-TableColumns {
    param([string]$line)
    # Remove escaped pipes \| and backticked content `...`
    # Replace \` with something else first if needed
    $temp = $line
    $temp = [regex]::Replace($temp, '\\\|', 'ESCAPED_PIPE')
    $temp = [regex]::Replace($temp, '`[^`]*`', 'CODE_BLOCK')
    
    # Must start and end with pipe
    $trimmed = $temp.Trim()
    if ($trimmed.StartsWith('|') -and $trimmed.EndsWith('|')) {
        $trimmed = $trimmed.Substring(1, $trimmed.Length - 2)
        $parts = $trimmed.Split('|')
        return $parts.Count
    }
    return -1
}

function Is-SeparatorRow {
    param([string]$line)
    $trimmed = $line.Trim()
    return ($trimmed -match '^\s*\|(\s*:?-{2,}:?\s*\|)+\s*$')
}

$mdFiles = Get-ChildItem -Path $Path -Filter "*.md" -Recurse | Where-Object {
    $_.FullName -notmatch '[\\/]reference([\\/]|$)' -and
    $_.FullName -notmatch '[\\/]\.gemini([\\/]|$)' -and
    $_.FullName -notmatch '[\\/]target([\\/]|$)' -and
    $_.FullName -notmatch '[\\/]node_modules([\\/]|$)' -and
    $_.FullName -notmatch '[\\/]\.git([\\/]|$)'
}

Write-Output "=== Markdown Table Linter ==="
Write-Output "Scanning $($mdFiles.Count) Markdown files..."
Write-Output ""

foreach ($file in $mdFiles) {
    $FilesChecked++
    $relPath = Resolve-Path -Relative $file.FullName
    $lines = Get-Content -Path $file.FullName
    $inCodeBlock = $false
    $inTable = $false
    $headerCols = 0
    $headerLineNum = 0
    $tableHasSeparator = $false

    for ($i = 0; $i -lt $lines.Count; $i++) {
        $lineNum = $i + 1
        $line = $lines[$i]
        $trimmed = $line.Trim()

        # Fenced code blocks toggle
        if ($trimmed -match '^```') {
            $inCodeBlock = -not $inCodeBlock
            if ($inTable) {
                $inTable = $false
            }
            continue
        }

        if ($inCodeBlock) {
            continue
        }

        # Check for broken separator row fragments (e.g. line starting with -|--- or |--- with no ending |)
        if (-not $inTable -and ($trimmed -match '^-+\|-+' -or ($trimmed -match '^\|-+' -and -not $trimmed.EndsWith('|')))) {
            Write-Output "[ERROR] Broken separator row fragment at ${relPath}:${lineNum} -> '$trimmed'"
            $ErrorCount++
            continue
        }

        # If line looks like a table row (starts and ends with |)
        if ($trimmed.StartsWith('|') -and $trimmed.EndsWith('|') -and $trimmed.Length -gt 1) {
            if (-not $inTable) {
                # Could this be a header?
                # Check next line
                if ($i + 1 -lt $lines.Count) {
                    $nextLine = $lines[$i + 1].Trim()
                    if (Is-SeparatorRow $nextLine) {
                        # Valid start of table
                        $inTable = $true
                        $headerCols = Count-TableColumns $trimmed
                        $headerLineNum = $lineNum
                        $tableHasSeparator = $true
                        continue
                    } elseif ($nextLine.StartsWith('|') -and -not (Is-SeparatorRow $nextLine)) {
                        # Table without separator row!
                        Write-Output "[ERROR] Table without separator row at ${relPath}:${lineNum}"
                        $ErrorCount++
                        $inTable = $true
                        $headerCols = Count-TableColumns $trimmed
                        $headerLineNum = $lineNum
                        $tableHasSeparator = $false
                        continue
                    } else {
                        # Next line is neither separator nor table row, or broken
                        # Check if next line looks like partial separator
                        if ($nextLine -match '^-' -or $nextLine -match '^\|-') {
                            Write-Output "[ERROR] Broken separator row following header at ${relPath}:${lineNum}"
                            $ErrorCount++
                        } else {
                            Write-Output "[WARNING] Standalone pipe row or missing separator at ${relPath}:${lineNum}"
                            $WarningCount++
                        }
                        continue
                    }
                } else {
                    Write-Output "[WARNING] Table header at end of file without rows at ${relPath}:${lineNum}"
                    $WarningCount++
                    continue
                }
            } else {
                # We are in table
                if (Is-SeparatorRow $trimmed) {
                    # Separator row encountered
                    continue
                }

                # Data row
                $cols = Count-TableColumns $trimmed
                if ($cols -ne $headerCols) {
                    Write-Output "[ERROR] Column count mismatch at ${relPath}:${lineNum}: expected $headerCols columns (from header at line $headerLineNum), found $cols columns"
                    $ErrorCount++
                }

                # Check for unescaped pipes inside cells
                # An unescaped pipe outside code spans and outside boundary | causes extra columns or cell corruption
                $temp = $trimmed.Substring(1, $trimmed.Length - 2)
                $tempWithoutCode = [regex]::Replace($temp, '`[^`]*`', '')
                if ($tempWithoutCode -match '(?<!\\)\|\|') {
                    Write-Output "[ERROR] Empty cell or double unescaped pipe at ${relPath}:${lineNum}"
                    $ErrorCount++
                }
            }
        } else {
            # Line does not start and end with |
            if ($inTable) {
                # If blank line or normal text, table ends
                # But check if this was a blank line inside a broken table (e.g. next line has table rows)
                if ($trimmed -eq '') {
                    # Check if subsequent lines continue a table
                    if ($i + 1 -lt $lines.Count -and ($lines[$i + 1].Trim().StartsWith('|') -or $lines[$i + 1].Trim() -match '^-+\|-+')) {
                        Write-Output "[ERROR] Blank or broken line inside table at ${relPath}:${lineNum}"
                        $ErrorCount++
                    } else {
                        # Natural end of table
                        $inTable = $false
                    }
                } else {
                    # Non-blank line that doesn't start/end with |
                    if ($i + 1 -lt $lines.Count -and $lines[$i + 1].Trim().StartsWith('|')) {
                        Write-Output "[ERROR] Broken line inside table at ${relPath}:${lineNum}: '$trimmed'"
                        $ErrorCount++
                    } else {
                        $inTable = $false
                    }
                }
            }
        }
    }
}

Write-Output ""
Write-Output "=== Summary ==="
Write-Output "Files checked: $FilesChecked"
Write-Output "Errors: $ErrorCount"
Write-Output "Warnings: $WarningCount"

if ($ErrorCount -gt 0) {
    Write-Output "STATUS: FAILED"
    exit 1
} else {
    Write-Output "STATUS: PASSED (Zero problems found)"
    exit 0
}
