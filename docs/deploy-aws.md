# Deploying to AWS

This guide puts the full site on one AWS server (an EC2 instance). The site, its PostgreSQL database and
[Caddy](https://caddyserver.com) all run there, and Caddy gets and renews the HTTPS certificate automatically. It is the
simplest and cheapest setup, and it fits comfortably in AWS's free credits for new accounts.

Allow about an hour the first time. Everything you type on the server is in a grey box you can copy.

**What you'll end up with**

```
 visitors ──HTTPS──▶ EC2 server ┬─ Caddy (HTTPS, port 80/443)
                                ├─ the site (Next.js)
                                └─ PostgreSQL ── disk: database + uploaded videos
```

**What it costs.** Roughly $20 a month at normal prices for a `t3.small` server, its disk and a fixed IP address, plus
data transfer when students watch videos. New AWS accounts get $100–200 of credits on a six-month Free plan, which covers
it. Check current prices for your region in the [AWS Pricing Calculator](https://calculator.aws/).

---

## 1. Create the AWS account

1. Sign up at [aws.amazon.com](https://aws.amazon.com/) and choose the **Free plan** if offered.
2. In the top-right corner, pick the **region** closest to your students (for example *Europe (Ireland)* or
   *Africa (Cape Town)*). Create everything below in that same region.
3. Set a spending alert: search for **Budgets** → **Create budget** → *Zero spend budget* or *Monthly cost budget*, and
   enter your email. AWS emails you before you're charged.

## 2. Launch the server

Search for **EC2** → **Launch instance**, and set:

| Setting | Value |
| --- | --- |
| Name | `amber` |
| Application and OS image | **Ubuntu Server 24.04 LTS** (64-bit x86) |
| Instance type | **t3.small** (2 GB memory). `t3.micro` (1 GB) also works for a small site, as long as you add the swap file in step 5. |
| Key pair | **Create new key pair**, type RSA, format `.pem`. Keep the downloaded file safe; it's how you get into the server. |
| Network settings → Edit | Allow **SSH** from **My IP**, and tick **Allow HTTPS traffic** and **Allow HTTP traffic from the internet**. |
| Configure storage | **30 GiB**, type **gp3**. Uploaded videos live here; you can grow it later. |
| Advanced details → Metadata response hop limit | **2** (needed only if you later use S3 for uploads, step 9). |

Click **Launch instance**.

## 3. Give it a fixed address

A server's public address changes when it restarts, unless you attach an Elastic IP.

1. EC2 → **Elastic IPs** → **Allocate Elastic IP address** → **Allocate**.
2. Select the new address → **Actions → Associate Elastic IP address** → choose the `amber` instance → **Associate**.

Write the address down (for example `203.0.113.10`).

## 4. Point your domain at it (recommended)

HTTPS needs a domain name. At the company where you bought your domain (or in Route 53), add a DNS record:

| Type | Name | Value |
| --- | --- | --- |
| A | `learn` (or `@` for the bare domain) | your Elastic IP |

This makes, for example, `learn.example.com` point at the server. It can take a few minutes to start working.

No domain yet? You can still try the site on `http://<your Elastic IP>`, without HTTPS. Don't let real users sign in
that way, because passwords would travel unencrypted.

## 5. Connect and install Docker

Connect from the browser: EC2 → **Instances** → select `amber` → **Connect** → **EC2 Instance Connect** → **Connect**.
(Or from your computer: `ssh -i amber.pem ubuntu@<your Elastic IP>`.)

Add 2 GB of swap, so building the site never runs out of memory:

```bash
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile && echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

Install Docker:

```bash
curl -fsSL https://get.docker.com | sudo sh
```

```bash
sudo usermod -aG docker ubuntu
```

Then **disconnect and connect again**, so the new permission applies.

## 6. Download the site and configure it

```bash
git clone https://github.com/pizzatechies/amber.git
```

```bash
cd amber/deploy/aws && cp .env.example .env
```

Generate a database password and copy what it prints:

```bash
openssl rand -hex 24
```

Open the settings file:

```bash
nano .env
```

Fill in at least these (Ctrl+O, Enter to save; Ctrl+X to exit):

| Setting | With a domain | Without a domain (testing) |
| --- | --- | --- |
| `SITE_ADDRESS` | `learn.example.com` | `:80` |
| `APP_URL` | `https://learn.example.com` | `http://<your Elastic IP>` |
| `DB_PASSWORD` | the password you generated | same |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | your admin login | same |

`SITE_NAME` and `CURRENCY` set the brand name and currency. The other settings (payments, email, S3) can wait.

## 7. Start it

```bash
docker compose up -d --build
```

The first build takes 5–10 minutes. When it finishes, check that all three parts are running:

```bash
docker compose ps
```

You should see `app`, `caddy` and `db` all `running` (the database also shows `healthy`). Open your address in a browser
and log in with the admin email and password from `.env`. With a domain, the HTTPS certificate is issued on the first
visit, which can take a few seconds.

**Optional: load the sample leadership courses** to see the site with content. Don't do this on a site real people will
use, because the demo accounts share a public password.

```bash
docker compose exec app npm run db:seed:demo
```

## 8. Day-to-day

**Update to the latest version.** The new version is built while the old one keeps running; the switch-over takes a few seconds:

```bash
cd ~/amber && git pull && cd deploy/aws && docker compose up -d --build
```

**Daily database backups.** Open the schedule:

```bash
crontab -e
```

and add this line, which backs up every night at 03:15 and keeps 14 days:

```
15 3 * * * /home/ubuntu/amber/deploy/aws/backup.sh >> /home/ubuntu/backup.log 2>&1
```

Backups are saved in `~/amber/deploy/aws/backups/`. They are on the same server, so also copy them elsewhere: either
download them now and then, or send them to S3 automatically (step 9). Also consider EC2's snapshot schedule (EC2 →
**Lifecycle Manager**) to back up the whole disk, including uploaded videos.

**Restore a backup** (replaces the current database):

```bash
gunzip -c backups/amber-YYYYMMDD-HHMMSS.sql.gz | docker compose exec -T db psql -U amber amber
```

**See what the site is doing:**

```bash
docker compose logs -f app
```

Without email configured, password-reset links appear here.

---

## 9. Optional upgrades

### Send emails with Amazon SES

1. Search for **Amazon Simple Email Service** → **Get started**, and verify your domain (or a sending address).
2. **SMTP settings** → **Create SMTP credentials**.
3. In `.env`, set `SMTP_URL=smtp://<username>:<password>@email-smtp.<region>.amazonaws.com:587` and `MAIL_FROM` to your
   verified address.
4. New SES accounts can only send to verified addresses until you **request production access** in the SES console.

### Store uploads in S3

Useful when videos outgrow the server's disk.

1. **S3 → Create bucket** in the same region. Keep *Block all public access* on: the site serves files through
   short-lived signed links.
2. **IAM → Roles → Create role** → trusted entity *AWS service*, use case *EC2*. Create an inline policy with this JSON,
   replacing `YOUR-BUCKET`:

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject", "s3:AbortMultipartUpload", "s3:ListMultipartUploadParts"],
         "Resource": "arn:aws:s3:::YOUR-BUCKET/*"
       },
       { "Effect": "Allow", "Action": ["s3:ListBucket"], "Resource": "arn:aws:s3:::YOUR-BUCKET" }
     ]
   }
   ```

3. EC2 → select `amber` → **Actions → Security → Modify IAM role** → choose the role.
4. If you didn't set it at launch: **Actions → Instance settings → Modify instance metadata options** → hop limit **2**.
   Without this, the site (which runs in a container) can't use the role.
5. In `.env`, set `STORAGE_DRIVER=s3`, `S3_BUCKET=YOUR-BUCKET` and `S3_REGION` to your region. Leave the key variables
   empty: the role provides access. Then run `docker compose up -d`.

Files uploaded before the switch stay on the server's disk and stop being reachable. Switch before you upload real
content, or copy the `uploads` volume into the bucket first.

To send backups to S3 as well, add the backup bucket to the role's policy, install the AWS command line
(`sudo snap install aws-cli --classic`), and put `BACKUP_BUCKET=your-backup-bucket` at the start of the cron line.

### Use Amazon RDS instead of the bundled database

RDS takes care of database backups, patching and failover, for extra cost.

1. **RDS → Create database** → *Standard create* → **PostgreSQL** (or **Aurora PostgreSQL**), version 16 or newer.
2. Under *Connectivity*, choose **Connect to an EC2 compute resource** and select `amber`. This lets the server reach
   the database and nobody else.
3. Note the endpoint, user and password, and create a database named `amber`.
4. In `.env`, uncomment `DATABASE_URL` and fill it in, ending with `?sslmode=require`.
5. In `compose.yaml`, delete the `db` service and the `depends_on` block under `app`, then run
   `docker compose up -d --build`. The site creates its tables on first start.
6. `backup.sh` only backs up the bundled database. RDS makes its own automatic backups; set how long they're kept in
   the database's *Maintenance & backups* settings.

### Take payments

Follow *Payments* in the main README to switch `PAYMENT_PROVIDER` to `stripe`. Do a test purchase and refund with Stripe
test keys first.

---

## Troubleshooting

| Problem | What to check |
| --- | --- |
| The page doesn't load at all | The security group allows HTTP (80) and HTTPS (443), and `docker compose ps` shows all three services running. |
| Browser says the certificate is invalid | The domain's A record points at the Elastic IP (`ping learn.example.com` should show it), and `SITE_ADDRESS` is the bare domain without `https://`. Caddy's log: `docker compose logs caddy`. |
| "502 Bad Gateway" | The site is still starting, or stopped. See `docker compose logs app`. |
| The build stops with "Killed" | The server ran out of memory: add the swap file from step 5, or use a larger instance. |
| Logins fail or redirect oddly | `APP_URL` must exactly match the address in the browser, including `https://`. Run `docker compose up -d` after changing it. |
| Uploads fail with S3 | The role is attached, the policy names the right bucket, and the metadata hop limit is 2. |
