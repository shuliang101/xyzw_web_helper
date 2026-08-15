# Agent Rules

1. When reading or editing files that may contain Chinese or other non-ASCII text, always use explicit UTF-8 handling. Do not use PowerShell's default `Get-Content` / `Set-Content` path for full-file rewrites, because it can display or persist mojibake in UTF-8 files without BOM. Prefer `apply_patch` for small edits, or explicitly use `[System.Text.Encoding]::UTF8` for inspection and write-back.
