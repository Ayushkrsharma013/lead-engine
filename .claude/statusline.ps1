$repo = 'C:\Users\ayush\Desktop\Ayush\lead-engine'
$branch = & git -C $repo branch --show-current 2>$null
if (-not $branch) { $branch = '?' }
$model = $env:CLAUDE_MODEL
if (-not $model) { $model = 'claude' }
$display = $model -replace '^claude-', '' -replace '-\d{8}$', ''
Write-Output "$branch | $display"
