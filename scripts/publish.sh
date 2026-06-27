#!/bin/bash
set -e

echo "=== Building VibeServe ==="
rm -rf dist/
python -m build

echo ""
echo "=== Verifying distribution ==="
python -m twine check dist/*

echo ""
echo "=== Ready to publish ==="
echo "  Run: python -m twine upload dist/*"
echo ""
echo "  For trusted publishing (OIDC) with PyPI, ensure your"
echo "  GitHub org/repo is configured at https://pypi.org/manage/project/vibeserve/settings/publishing/"
echo "  and run: python -m twine upload --repository pypi dist/*"
