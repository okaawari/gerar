# Quick cPanel Setup Guide

## Step-by-Step: First Time Setup

### 1. Prepare Your Git Repository

```bash
# Make sure all changes are committed
git status

# Commit .cpanel.yml if not already committed
git add .cpanel.yml
git add DEPLOYMENT.md
git commit -m "Add cPanel deployment configuration"
git push origin main
```

### 2. Get Your Repository URL

Copy your Git repository URL:
- **GitHub**: `https://github.com/username/repo.git` or `git@github.com:username/repo.git`
- **GitLab**: `https://gitlab.com/username/repo.git`
- **Bitbucket**: `https://bitbucket.org/username/repo.git`

### 3. Clone Repository in cPanel

1. **Log in to cPanel**
2. **Files → Git™ Version Control** (or search "Git" in cPanel)
3. Click **Clone** or **Create** button
4. Enter:
   - **Clone URL**: Your Git repository URL
   - **Repository Name**: `ecommerce` (or your preferred name)
   - **Repository Path**: Leave default (usually `/home/username/repositories/ecommerce`)
5. Click **Clone** or **Create**

### 4. Edit `.cpanel.yml` Before First Deployment

**Before deploying**, you MUST update the deployment path:

1. In cPanel, go to **File Manager**
2. Navigate to your repository directory: `/home/username/repositories/ecommerce`
3. Edit `.cpanel.yml`
4. Change line 9: Replace `username` with your actual cPanel username
   ```yaml
   - export DEPLOYPATH=/home/YOUR_CPANEL_USERNAME/public_html/api/
   ```
5. Save the file

### 5. Initial Deployment

1. Go back to **Git Version Control**
2. Click **Manage** next to your repository
3. Go to **Pull or Deploy** tab
4. Click **Update from Remote** (to ensure latest code)
5. Click **Deploy HEAD Commit** (this runs `.cpanel.yml`)

### 6. Set Up Environment Variables

After deployment, create `.env` file:

1. **File Manager** → Navigate to your deployment directory (`/home/username/public_html/api/`)
2. Create new file: `.env`
3. Add your production environment variables:

```env
DATABASE_URL="mysql://dbuser:dbpass@localhost:3306/dbname"
PORT=3000
NODE_ENV=production
JWT_SECRET=generate-a-strong-random-secret-here
JWT_EXPIRES_IN=7d
CORS_ORIGIN=https://yourdomain.com
```

**To generate a strong JWT_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 7. Set Up Database

1. **cPanel → MySQL Databases**
2. Create new database: `ecommerce_db` (or your preferred name)
3. Create new user: `ecommerce_user` (or your preferred name)
4. Assign user to database with **ALL PRIVILEGES**
5. Note down:
   - Database name
   - Username
   - Password (if you set one)
   - Host (usually `localhost`)

6. Update `.env` with these credentials:
   ```
   DATABASE_URL="mysql://ecommerce_user:password@localhost:3306/ecommerce_db"
   ```

### 8. Run Database Migrations

**Option A: Via SSH (Easiest)**

```bash
ssh username@yourdomain.com
cd ~/public_html/api/
npx prisma migrate deploy
```

**Option B: Via cPanel Terminal**

1. **cPanel → Terminal** (if available)
2. Run:
   ```bash
   cd ~/public_html/api/
   npx prisma migrate deploy
   ```

**Option C: Via cPanel File Manager**

1. Navigate to deployment directory
2. Create `run-migrations.sh`:
   ```bash
   #!/bin/bash
   cd /home/username/public_html/api/
   npx prisma migrate deploy
   ```
3. Make it executable
4. Run it via Terminal or SSH

### 9. Set Up Node.js Application (if using Node.js Selector)

1. **cPanel → Node.js Selector**
2. Click **Create Application**
3. Fill in:
   - **Application root**: `/home/username/public_html/api`
   - **Application URL**: Choose domain/subdomain
   - **Application startup file**: `src/server.js`
   - **Node.js version**: 18.x or 20.x
4. Click **Create**
5. The app should start automatically

### 10. Verify Deployment

Test your API:

```bash
# Health check
curl https://yourdomain.com/api/

# Should return:
# {"success":true,"message":"Ecommerce API is running",...}
```

## Troubleshooting

### Deployment Fails

**Problem**: `.cpanel.yml` errors
- **Solution**: Check YAML syntax, ensure paths are correct
- **Check**: Deployment path uses your actual cPanel username

**Problem**: Permission denied
- **Solution**: Ensure deployment directory is writable
- **Check**: File permissions in cPanel File Manager

### Products Not Showing

**Problem**: Database not connected
- **Solution**: Check `.env` DATABASE_URL is correct
- **Verify**: Can connect to database from cPanel

**Problem**: Migrations not applied
- **Solution**: Run `npx prisma migrate deploy` manually
- **Check**: ProductCategory table exists

**Problem**: Prisma Client not generated
- **Solution**: Run `npx prisma generate` manually
- **Check**: `node_modules/.prisma` directory exists

### Node.js App Won't Start

**Problem**: Port already in use
- **Solution**: Check PORT in `.env` matches Node.js Selector config
- **Change**: Use the port assigned by cPanel

**Problem**: Missing dependencies
- **Solution**: Run `npm ci --production` manually
- **Check**: `node_modules` directory exists

### 403 Forbidden Errors (mod_security)

**Problem**: PUT/PATCH requests returning 403 errors or `/403.shtml` errors
- **Cause**: mod_security is blocking requests before they reach Node.js
- **Solutions** (try in order):

  1. **Deploy the updated `.htaccess` file**:
     - The `.htaccess` file now includes directives to disable mod_security for the API directory
     - Deploy the updated file and test again
  
  2. **Check mod_security logs in cPanel**:
     - Go to **Security → ModSecurity Tools** (or **Security → ModSecurity™**)
     - Check recent blocks and rule IDs
     - Look for the specific rule ID blocking PUT/PATCH requests
     - Update `.htaccess` with the specific rule IDs if needed
  
  3. **CloudLinux/WHM specific solutions**:
     - **Option A**: In WHM (Web Host Manager), go to **Security Center → ModSecurity™ Configuration**
       - Find your domain and disable mod_security for it
       - Or create an exception for the `/api/` path
     
     - **Option B**: In cPanel, go to **Security → ModSecurity™ Tools**
       - Look for whitelisting options
       - Add your API path or domain to the whitelist
     
     - **Option C**: If you have WHM access, create a custom rule:
       - WHM → **Security Center → ModSecurity™ Tools**
       - Create exception for PUT/PATCH/DELETE methods on `/api/*` paths
  
  4. **Contact hosting support** (if .htaccess doesn't work):
     - CloudLinux/cPanel often doesn't allow disabling mod_security via `.htaccess`
     - Ask them to:
       - Whitelist your API directory (`/home/gerarmn/api.gerar.mn/`)
       - Allow PUT/PATCH/DELETE methods for your API routes
       - Provide them with the mod_security rule IDs from logs
       - Request they disable mod_security for your Node.js application directory

**Problem**: Error message "Access forbidden. This may be due to server-level restrictions."
- **Cause**: Apache/mod_security blocking the request and redirecting to `/403.shtml`
- **Quick Check**: 
  - Verify `.htaccess` is deployed in `/home/gerarmn/api.gerar.mn/`
  - Check if mod_security directives in `.htaccess` are working (some hosts block `.htaccess` mod_security config)
  - If `.htaccess` doesn't work, you MUST use WHM/cPanel interface or contact support

## Quick Reference

### Essential Commands (run in deployment directory)

```bash
# Install dependencies
npm ci --production

# Generate Prisma Client
npx prisma generate

# Run migrations
npx prisma migrate deploy

# Check Prisma status
npx prisma migrate status

# View logs (if PM2 or similar is used)
pm2 logs
```

### File Locations

- **Repository**: `/home/username/repositories/ecommerce/`
- **Deployment**: `/home/username/public_html/api/`
- **Environment file**: `/home/username/public_html/api/.env`
- **Logs**: Check cPanel error logs or Node.js application logs

### Updating Your Application

1. Make changes locally
2. Commit and push:
   ```bash
   git add .
   git commit -m "Your changes"
   git push origin main
   ```
3. In cPanel Git Version Control:
   - Click **Manage** on your repository
   - **Pull or Deploy** tab
   - Click **Update from Remote**
   - Click **Deploy HEAD Commit**

Or if auto-deployment is enabled, just push and it will deploy automatically!
