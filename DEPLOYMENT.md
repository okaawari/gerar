# Deployment Guide for cPanel

This guide will help you deploy your ecommerce API to cPanel using Git Version Control.

## Prerequisites

1. **cPanel Access** - You need access to a cPanel hosting account with:
   - Git Version Control feature enabled
   - Node.js Selector available (for Node.js apps)
   - MySQL database access
   - SSH access (recommended, but not required)

2. **Git Repository** - Your project should be in a Git repository (GitHub, GitLab, Bitbucket, etc.)

## Step 1: Prepare Your Project

### 1.1 Update `.cpanel.yml`

Before deploying, **edit `.cpanel.yml`** and update the deployment path:

```yaml
# Line 9: Replace 'username' with your actual cPanel username
- export DEPLOYPATH=/home/yourusername/public_html/api/
```

**Common Deployment Paths:**
- **Main API**: `/home/username/public_html/api/`
- **Node.js App**: `/home/username/node_app/`
- **Subdirectory**: `/home/username/public_html/backend/`

### 1.2 Verify `.gitignore`

Make sure `.gitignore` includes:
- `node_modules/`
- `.env` and all environment files
- IDE files (`.vscode/`, `.idea/`)
- Test files (optional, but recommended to exclude `tests/`)

### 1.3 Commit Your Changes

```bash
git add .
git commit -m "Prepare for cPanel deployment"
git push origin main
```

## Step 2: Set Up in cPanel

### 2.1 Create Repository in cPanel

1. Log in to **cPanel**
2. Navigate to **Files → Git™ Version Control**
3. Click **Create** or **Clone** (depending on your cPanel version)
4. Choose one of these options:

#### Option A: Clone Existing Repository
- **Repository URL**: Enter your Git repository URL (e.g., `https://github.com/username/repo.git`)
- **Repository Path**: Leave default or specify custom path
- **Clone**: Click to clone

#### Option B: Create New Repository
- Click **Create** and follow the prompts
- Then connect it to your remote repository

### 2.2 Configure Deployment

1. After cloning/creating, you'll see your repository in the list
2. Click **Manage** next to your repository
3. Go to **Pull or Deploy** tab
4. The `.cpanel.yml` file should be automatically detected
5. Click **Deploy HEAD Commit** to deploy

## Step 3: Configure Environment Variables

### 3.1 Create `.env` File in cPanel

1. In cPanel File Manager, navigate to your deployment directory
2. Create a `.env` file with your production values:

```env
DATABASE_URL="mysql://dbuser:dbpassword@localhost:3306/dbname"
PORT=3000
NODE_ENV=production
JWT_SECRET=your-production-jwt-secret-key
JWT_EXPIRES_IN=7d
CORS_ORIGIN=https://yourdomain.com
```

**Important Security Notes:**
- Use strong, random JWT_SECRET in production
- Never commit `.env` file to Git
- Use cPanel's Environment Variables feature if available

### 3.2 Set Up Database

1. Create MySQL database in cPanel:
   - **cPanel → MySQL Databases**
   - Create new database and user
   - Grant all privileges to user on database
   - Note the connection details

2. Update your `.env` with database credentials:
   ```
   DATABASE_URL="mysql://dbuser:dbpassword@localhost:3306/dbname"
   ```

## Step 4: Run Database Migrations

### Option A: Via SSH (Recommended)

If you have SSH access:

```bash
# SSH into your cPanel account
ssh username@yourdomain.com

# Navigate to deployment directory
cd ~/public_html/api/

# Run migrations
npx prisma migrate deploy

# Optional: Run seed data
npm run seed
```

### Option B: Via cPanel Terminal

1. In cPanel, open **Terminal** or **SSH Access**
2. Navigate to your deployment directory
3. Run: `npx prisma migrate deploy`

### Option C: Uncomment in `.cpanel.yml`

In `.cpanel.yml`, uncomment line 40:
```yaml
- npx prisma migrate deploy
```

**Warning**: This will run migrations automatically on every deployment. Only enable if you're sure.

## Step 5: Configure Node.js (if using Node.js Selector)

1. In cPanel, go to **Node.js Selector**
2. Create a new application:
   - **Application root**: Your deployment directory
   - **Application URL**: Choose your subdomain or path
   - **Application startup file**: `src/server.js`
   - **Node.js version**: 18.x or 20.x (recommended)
3. Install dependencies (if not done by deployment):
   ```
   npm ci --production
   ```
4. Start/Restart the application

## Step 6: Set Up Automatic Deployment (Optional)

### Push Deployment (Automatic)

When you push to your Git repository, cPanel can automatically deploy:

1. In cPanel Git interface, ensure **Automatic Deployment** is enabled
2. When you push to your main branch, cPanel will:
   - Pull the latest changes
   - Run the deployment tasks from `.cpanel.yml`

### Manual Deployment

1. Go to **Git Version Control** in cPanel
2. Click **Manage** on your repository
3. Click **Pull or Deploy** tab
4. Click **Update from Remote** to pull latest changes
5. Click **Deploy HEAD Commit** to deploy

## Step 7: Verify Deployment

### Check Deployment

1. **Check Files**: Verify files are in the deployment directory
2. **Check Node Modules**: Ensure `node_modules` exists and has dependencies
3. **Check Prisma**: Verify Prisma Client is generated
4. **Check Logs**: Review application logs for errors

### Test API

```bash
# Health check
curl https://yourdomain.com/api/

# Test authentication
curl -X POST https://yourdomain.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"12345678","pin":"1234"}'
```

## Troubleshooting

### Products Not Showing

If products aren't showing after deployment:

1. **Check Database Connection**: Verify `.env` DATABASE_URL is correct
2. **Run Migrations**: Ensure migrations are applied:
   ```bash
   npx prisma migrate deploy
   ```
3. **Check Prisma Client**: Regenerate if needed:
   ```bash
   npx prisma generate
   ```
4. **Verify ProductCategory Table**: Check if it exists and has data

### Deployment Fails

1. **Check `.cpanel.yml` Syntax**: Ensure YAML is valid
2. **Check File Permissions**: Deployment path must be writable
3. **Check Logs**: Review cPanel error logs
4. **Manual Steps**: Try running deployment steps manually via SSH

### Node.js App Not Starting

1. **Check Node.js Version**: Ensure compatible version in Node.js Selector
2. **Check Port**: Verify PORT in `.env` matches cPanel configuration
3. **Check Logs**: Review application logs in cPanel
4. **Check Startup File**: Verify `src/server.js` exists and is correct

## Security Checklist

- [ ] `.env` file is created with production values
- [ ] `.env` is in `.gitignore` (not committed to Git)
- [ ] Strong JWT_SECRET is set
- [ ] Database credentials are secure
- [ ] CORS_ORIGIN is set to your actual domain
- [ ] Node.js app is configured with proper permissions
- [ ] Database migrations are applied
- [ ] Production dependencies only (no dev dependencies in production)

## Post-Deployment

After successful deployment:

1. **Test All Endpoints**: Verify API is working
2. **Monitor Logs**: Keep an eye on application logs
3. **Set Up Backups**: Configure database backups in cPanel
4. **Set Up Monitoring**: Consider adding uptime monitoring
5. **Document Credentials**: Store production credentials securely (password manager)

## Updating the Deployment

To update your application:

1. Make changes locally
2. Commit and push to Git:
   ```bash
   git add .
   git commit -m "Update: description of changes"
   git push origin main
   ```
3. In cPanel, click **Update from Remote** then **Deploy HEAD Commit**
   Or if auto-deployment is enabled, it will deploy automatically

## Support

If you encounter issues:
1. Check cPanel error logs
2. Check Node.js application logs
3. Verify all environment variables are set
4. Ensure database is accessible and migrations are applied
