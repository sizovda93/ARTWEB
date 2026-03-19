"""Helper script for executing commands on the remote server via SSH."""
import paramiko
import sys
import os


def get_ssh_client():
    """Create and return an SSH client connected to the server."""
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    host = os.environ.get("ARTWEB_SSH_HOST", "5.42.110.182")
    user = os.environ.get("ARTWEB_SSH_USER", "root")
    password = os.environ.get("ARTWEB_SSH_PASSWORD", "")
    ssh.connect(host, username=user, password=password, timeout=15)
    return ssh


def run(cmd, ssh=None):
    """Execute a command on the remote server and return stdout."""
    close = False
    if ssh is None:
        ssh = get_ssh_client()
        close = True
    try:
        stdin, stdout, stderr = ssh.exec_command(cmd, timeout=60)
        out = stdout.read().decode("utf-8", errors="replace").strip()
        err = stderr.read().decode("utf-8", errors="replace").strip()
        exit_code = stdout.channel.recv_exit_status()
        return out, err, exit_code
    finally:
        if close:
            ssh.close()


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python ssh_exec.py <command>")
        sys.exit(1)
    cmd = " ".join(sys.argv[1:])
    out, err, code = run(cmd)
    if out:
        sys.stdout.buffer.write(out.encode("utf-8") + b"\n")
    if err:
        sys.stderr.buffer.write(err.encode("utf-8") + b"\n")
    sys.exit(code)
