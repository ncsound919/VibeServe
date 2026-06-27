import tomllib
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent


class TestPipelineSecurity:
    def test_pyproject_toml_valid(self):
        toml = tomllib.loads((PROJECT_ROOT / "pyproject.toml").read_text("utf-8"))
        assert toml["project"]["name"] == "vibeserve"

    def test_dockerfile_uses_pinned_digest(self):
        dockerfile = (PROJECT_ROOT / "Dockerfile").read_text()
        assert "@sha256:" in dockerfile, "Base image should use pinned digest"

    def test_dockerfile_non_root_user(self):
        dockerfile = (PROJECT_ROOT / "Dockerfile").read_text()
        assert "USER" in dockerfile and "root" not in dockerfile.split("USER")[-1][:20]

    def test_dockerfile_has_healthcheck(self):
        dockerfile = (PROJECT_ROOT / "Dockerfile").read_text()
        assert "HEALTHCHECK" in dockerfile

    def test_security_scan_workflow_exists(self):
        workflows = PROJECT_ROOT / ".github" / "workflows"
        assert (workflows / "security-scan.yml").exists()

    def test_security_scan_has_sbom(self):
        yaml = (PROJECT_ROOT / ".github" / "workflows" / "security-scan.yml").read_text()
        assert "sbom" in yaml

    def test_security_scan_has_codeql(self):
        yaml = (PROJECT_ROOT / ".github" / "workflows" / "security-scan.yml").read_text()
        assert "codeql" in yaml or "code-ql" in yaml

    def test_security_scan_has_container_scan(self):
        yaml = (PROJECT_ROOT / ".github" / "workflows" / "security-scan.yml").read_text()
        assert "trivy" in yaml

    def test_security_scan_has_license_check(self):
        yaml = (PROJECT_ROOT / ".github" / "workflows" / "security-scan.yml").read_text()
        assert "license" in yaml

    def test_ci_workflow_has_permissions(self):
        yaml = (PROJECT_ROOT / ".github" / "workflows" / "ci.yml").read_text()
        assert "permissions:" in yaml or "permissions :" in yaml

    def test_ci_has_pip_audit(self):
        yaml = (PROJECT_ROOT / ".github" / "workflows" / "ci.yml").read_text()
        assert "pip-audit" in yaml or "pip_audit" in yaml

    def test_dependabot_exists(self):
        assert (PROJECT_ROOT / ".github" / "dependabot.yml").exists()

    def test_dependabot_configured_for_pip(self):
        yaml = (PROJECT_ROOT / ".github" / "dependabot.yml").read_text()
        assert "pip" in yaml

    def test_security_md_exists(self):
        assert (PROJECT_ROOT / ".github" / "SECURITY.md").exists()

    def test_codeowners_exists(self):
        assert (PROJECT_ROOT / ".github" / "CODEOWNERS").exists()
