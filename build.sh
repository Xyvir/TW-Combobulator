#!/bin/sh
set -e

CONFIG="${1:-recipe.yaml}"

echo "Building with config: $CONFIG"
dagger call -m . combobulate --config="$CONFIG" --context='.' -o dist
