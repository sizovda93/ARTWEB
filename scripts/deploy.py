"""Deploy ARTWEB to production server.

Usage: python scripts/deploy.py

Requires: pip install paramiko scp
"""
import paramiko
import os
import sys
from scp import SCPClient

SERVER = os.environ.get("ARTWEB_SSH_HOST", "5.42.110.182")
USER = os.environ.get("ARTWEB_SSH_USER", "root")
PASSWORD = os.environ.get("ARTWEB_SSH_PASSWORD", "")
REMOTE_DIR = "/var/www/artweb"
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Files/dirs to exclude from upload
EXCLUDE = {
    "node_modules", ".next", ".git", ".claude", ".env",
    "src/generated", "__pycache__", ".DS_Store",
}


def get_ssh():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(SERVER, username=USER, password=PASSWORD, timeout=15)
    return ssh


def run(ssh, cmd, label=""):
    if label:
        print(f"  [{label}] {cmd[:80]}...")
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=300)
    out = stdout.read().decode("utf-8", errors="replace").strip()
    err = stderr.read().decode("utf-8", errors="replace").strip()
    code = stdout.channel.recv_exit_status()
    if out:
        print(f"    {out[:500]}")
    if code != 0 and err:
        print(f"    ERROR: {err[:500]}")
    return out, err, code


def upload_project(ssh):
    """Upload project files via SCP (excluding node_modules, .next, etc.)."""
    print("Uploading project files...")
    scp = SCPClient(ssh.get_transport())

    # Create a tar archive locally, excluding unwanted dirs
    import tarfile
    import io

    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        for item in os.listdir(PROJECT_ROOT):
            if item in EXCLUDE:
                continue
            path = os.path.join(PROJECT_ROOT, item)
            tar.add(path, arcname=item)

    buf.seek(0)
    size_mb = len(buf.getvalue()) / 1024 / 1024
    print(f"  Archive size: {size_mb:.1f} MB")

    # Upload archive
    sftp = ssh.open_sftp()
    with sftp.file(f"{REMOTE_DIR}/deploy.tar.gz", "wb") as f:
        f.write(buf.getvalue())
    sftp.close()

    # Extract on server
    run(ssh, f"cd {REMOTE_DIR} && tar xzf deploy.tar.gz && rm deploy.tar.gz", "extract")


def deploy():
    if not PASSWORD:
        print("Set ARTWEB_SSH_PASSWORD environment variable")
        sys.exit(1)

    ssh = get_ssh()
    print(f"Connected to {SERVER}")

    # 1. Upload files
    upload_project(ssh)

    # 2. Create .env on server
    print("Setting up environment...")
    env_content = f"""DATABASE_URL="postgresql://artweb_app:{os.environ.get('ARTWEB_DB_PASSWORD', 'SET_ME')}@127.0.0.1:5432/artweb"
NEXT_PUBLIC_APP_URL="http://{SERVER}:3003"
NODE_ENV="production"
PORT=3003
JWT_SECRET="{os.environ.get('ARTWEB_JWT_SECRET', 'SET_ME')}"
JWT_EXPIRES_IN="15m"
REFRESH_TOKEN_EXPIRES_IN="7d"
"""
    sftp = ssh.open_sftp()
    with sftp.file(f"{REMOTE_DIR}/.env", "w") as f:
        f.write(env_content)
    sftp.close()

    # 3. Install deps and build
    run(ssh, f"cd {REMOTE_DIR} && npm ci --omit=dev 2>&1 | tail -5", "npm install")
    run(ssh, f"cd {REMOTE_DIR} && npx prisma generate 2>&1", "prisma generate")
    run(ssh, f"cd {REMOTE_DIR} && npm run build 2>&1 | tail -10", "build")

    # 4. Restart with PM2
    run(ssh, f"pm2 delete artweb 2>/dev/null; cd {REMOTE_DIR} && pm2 start npm --name artweb -- start", "pm2")
    run(ssh, "pm2 save", "pm2 save")

    # 5. Verify
    out, _, _ = run(ssh, "sleep 3 && curl -s http://127.0.0.1:3003/api/health", "health check")
    print(f"\nHealth check: {out}")

    ssh.close()
    print("\nDeploy complete!")


if __name__ == "__main__":
    deploy()
