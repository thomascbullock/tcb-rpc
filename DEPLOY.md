# Deploy walkthrough (HAProxy + certbot → Caddy)

One-time migration for the server that has been running the pre-refactor
setup. Written for the specific machine that hosts thomascbullock.com. All
paths + assumptions are baked in — adjust for another host.

## Before you start

- Time budget: ~30–45 min including verification.
- Downtime window: the moments between stopping HAProxy and Caddy binding
  to :80/:443. Roughly 30 seconds if nothing surprises you.
- Have SSH open in two panes: one for issuing commands, one tailing logs.
- Take note of any posts you've made from MarsEdit or `/post` since the
  last local `git pull` — those commits live only on the server right
  now.

## 0. Sync git first

On **local**:
```
git pull        # grab any prod-side commits (auto-committed posts)
git push        # push the refactor stack
```

## 1. Back up data on the server

Everything under `posts/` and `img/` is your content. Snapshot it.

```
sudo cp -a /path/to/tcb-rpc/posts   /root/tcb-rpc-backup-$(date +%Y%m%d)/posts
sudo cp -a /path/to/tcb-rpc/img     /root/tcb-rpc-backup-$(date +%Y%m%d)/img
```

Also snapshot the existing HAProxy config in case you need to roll back:
```
sudo cp /etc/haproxy/haproxy.cfg /root/haproxy.cfg.pre-caddy
```

## 2. Pull the new code

Assume the current checkout is somewhere like `/home/user/tcb-rpc`. You
can leave it there, or move it to `/opt/tcb-rpc` for a cleaner layout
(the systemd unit expects `/opt/tcb-rpc`).

If moving:
```
sudo mv /home/user/tcb-rpc /opt/tcb-rpc
sudo chown -R root:root /opt/tcb-rpc     # code is root-owned, read-only for service
```

Pull the refactor:
```
cd /opt/tcb-rpc
sudo -u root git pull
sudo -u root npm ci --omit=dev            # install prod deps only
```

`argon2` is a native module; make sure `build-essential` + `python3` are
installed on the box (`apt install build-essential python3`) or npm ci
will fail on the argon2 build step.

## 3. Set up the data directory

Move `posts/` and `img/` out of the git checkout into their new home:

```
sudo mkdir -p /var/lib/tcb-rpc
sudo mv /opt/tcb-rpc/posts /var/lib/tcb-rpc/posts
sudo mv /opt/tcb-rpc/img   /var/lib/tcb-rpc/img
sudo mkdir /var/lib/tcb-rpc/build
sudo chown -R nobody:nogroup /var/lib/tcb-rpc  # placeholder; DynamicUser
                                                # takes over on first boot
```

(The systemd unit uses `DynamicUser=yes` + `StateDirectory=tcb-rpc`, so
the ownership above is temporary — systemd will re-chown to its ephemeral
uid on first start. Adjust the placeholder to whatever user your distro
uses for `nobody`.)

## 4. Migrate credentials

Generate the argon2 hash + a session secret:
```
cd /opt/tcb-rpc
sudo -u root node scripts/hash-password.js
# type the existing blog password twice; copy the two lines it prints
```

Write `/etc/tcb-rpc.env`:
```
sudo tee /etc/tcb-rpc.env >/dev/null <<'EOF'
BLOG_USER=your-existing-username
BLOG_PW_HASH='paste-the-hash-here'
SESSION_SECRET='paste-the-secret-here'
WEB_PORT=3000

# Optional:
# XMLRPC_PATH=/xmlrpc-random-suffix
# MASTODON_INSTANCE=https://...
# MASTODON_ACCESS_TOKEN=...
EOF
sudo chmod 600 /etc/tcb-rpc.env
```

You can delete `/opt/tcb-rpc/.env` if it still exists — the systemd unit
reads `/etc/tcb-rpc.env`, not the in-repo file.

## 5. Install + start the systemd unit

```
sudo cp /opt/tcb-rpc/deploy/tcb-rpc.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now tcb-rpc
sudo systemctl status tcb-rpc
sudo journalctl -u tcb-rpc -f          # watch it boot
```

Confirm it's serving locally:
```
curl -s http://127.0.0.1:3000/api/health
# → {"status":"ok",...}
```

## 6. Install Caddy

Debian/Ubuntu:
```
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo tee /etc/apt/trusted.gpg.d/caddy-stable.asc
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy
```

Drop in the config and reload:
```
sudo cp /opt/tcb-rpc/Caddyfile /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

## 7. The cutover

Caddy needs :80 and :443. HAProxy currently holds them. Swap:

```
sudo systemctl stop haproxy
sudo systemctl disable haproxy
sudo systemctl restart caddy
sudo systemctl status caddy
```

Caddy will spend 5–20 seconds provisioning a Let's Encrypt cert on first
serve. Watch for it in the log:
```
sudo journalctl -u caddy -f
```

Then verify from off-box:
```
curl -I https://thomascbullock.com/
# expect HTTP/2 200 (or 3xx for the homepage index)
```

Test MarsEdit against the same host — it should authenticate + list
recent posts. If XMLRPC_PATH is default, MarsEdit's endpoint URL is
`https://thomascbullock.com/xmlrpc` (unchanged).

## 8. Backup cron

The in-request `git push` from post.js is gone. Set up hourly backups:

```
sudo -u root git clone https://github.com/thomascbullock/tcb-rpc.git \
    /var/lib/tcb-rpc/backup
```

(Whatever your origin URL is. This is a second checkout used only by the
backup script.)

Then, as root:
```
sudo crontab -e
# add:
0 * * * * /opt/tcb-rpc/scripts/backup-posts.sh >> /var/log/tcb-rpc-backup.log 2>&1
```

## 9. Verify

Post a test entry from MarsEdit → should appear on the site within a
second (incremental rebuild). Confirm within an hour that
`/var/lib/tcb-rpc/backup/posts/` gets a new commit.

Post from `/post` (log in first via `/login`) → same expectation.

## Rollback

If Caddy misbehaves and the site is down:
```
sudo systemctl stop caddy
sudo cp /root/haproxy.cfg.pre-caddy /etc/haproxy/haproxy.cfg
sudo systemctl start haproxy
```
(You'd also want to revert the node process — `sudo systemctl stop
tcb-rpc` and restart the old process however you were running it before.
If code changes are the problem, `git checkout` a pre-refactor commit
in `/opt/tcb-rpc` and restart.)

If posts data went missing, `/root/tcb-rpc-backup-<date>/` from step 1
has your snapshot.
