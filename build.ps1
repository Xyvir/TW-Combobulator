param([string]$Config = "recipe.yaml")

# Check if Docker is running (Required for Dagger)
if (!(Get-Command "docker" -ErrorAction SilentlyContinue)) {
    Write-Warning "Docker is not found in PATH. Dagger requires a container engine (Docker) to run."
    Write-Warning "Please install Docker Desktop and ensure it is running."
    # We won't exit, we'll try anyway.
}

# Fallback: Run dagger directly since 'sh' might not be in PATH on simplified Windows envs
Write-Host "Building with config: $Config"
$env:NO_COLOR = "1"
& dagger call -m . combobulate --config="$Config" --context='.' -o dist *>&1 | Tee-Object -FilePath "build.log"
