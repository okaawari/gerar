# Pre-Deployment Checklist

Use this checklist before deploying to cPanel:

## ✅ Code Preparation

- [ ] All code changes are committed to Git
- [ ] `.cpanel.yml` deployment path is updated with your cPanel username
- [ ] `.gitignore` excludes sensitive files (`.env`, `node_modules`, etc.)
- [ ] `package-lock.json` is committed (for consistent dependency versions)
- [ ] All migrations are created and tested locally
- [ ] `.env.example` file exists (as reference, but not committed)

## ✅ Configuration Files

- [ ] `.cpanel.yml` deployment path is correct
- [ ] All necessary files are being copied in `.cpanel.yml`
- [ ] Database migrations are configured (commented/uncommented as needed)
- [ ] Package.json has correct start script: `"start": "node src/server.js"`

## ✅ Environment Variables (Create in cPanel)

After deployment, create `.env` file in deployment directory with:

- [ ] `DATABASE_URL` - MySQL connection string from cPanel
- [ ] `PORT` - Port number (usually provided by cPanel Node.js selector)
- [ ] `NODE_ENV=production`
- [ ] `JWT_SECRET` - Strong random secret (generate new for production!)
- [ ] `JWT_EXPIRES_IN=7d` (or your preferred expiry)
- [ ] `CORS_ORIGIN` - Your actual domain URL

## ✅ Database Setup

- [ ] MySQL database created in cPanel
- [ ] Database user created with proper permissions
- [ ] Connection credentials noted down securely
- [ ] Migrations will be run after deployment

## ✅ Testing Before Deployment

- [ ] Application runs locally without errors
- [ ] All migrations apply successfully
- [ ] Prisma Client generates without errors
- [ ] Database connection works
- [ ] API endpoints respond correctly

## ✅ Git Repository

- [ ] Repository is pushed to remote (GitHub/GitLab/Bitbucket)
- [ ] Repository URL is accessible from cPanel
- [ ] Main/master branch is up to date

## ✅ Post-Deployment Tasks

After initial deployment:

- [ ] Create `.env` file in deployment directory
- [ ] Run `npx prisma migrate deploy` to apply migrations
- [ ] Run `npx prisma generate` if needed
- [ ] Test API endpoints
- [ ] Verify products are showing correctly
- [ ] Check application logs for errors
- [ ] Set up Node.js application in cPanel Node.js Selector (if needed)

## Quick Commands

```bash
# After deployment via SSH/Terminal
cd /home/username/public_html/api/
npm ci --production
npx prisma generate
npx prisma migrate deploy
# Restart Node.js app in cPanel
```
