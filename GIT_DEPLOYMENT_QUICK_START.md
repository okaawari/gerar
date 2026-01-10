# Quick Start: Deploy to cPanel via Git

## ⚡ 5-Minute Setup

### 1. Update `.cpanel.yml` (REQUIRED)

**Open `.cpanel.yml` and change line 11:**
```yaml
- export DEPLOYPATH=/home/YOUR_CPANEL_USERNAME/public_html/api/
```
Replace `YOUR_CPANEL_USERNAME` with your actual cPanel username.

### 2. Commit and Push

```bash
git add .
git commit -m "Ready for cPanel deployment"
git push origin main
```

### 3. In cPanel

1. **Git Version Control** → **Clone**
2. **Repository URL**: Paste your Git repo URL
3. Click **Clone**

### 4. First Deployment

1. **Git Version Control** → **Manage** (on your repo)
2. **Pull or Deploy** tab
3. Click **Deploy HEAD Commit**

### 5. Configure Environment

**File Manager** → Navigate to `/home/username/public_html/api/`
- Create `.env` file with your production values
- See `env.example.txt` for template

### 6. Run Migrations

**Via SSH or Terminal:**
```bash
cd ~/public_html/api/
npx prisma migrate deploy
```

### 7. Set Up Node.js (if needed)

**Node.js Selector** → **Create Application**
- Application root: `/home/username/public_html/api`
- Startup file: `src/server.js`
- Port: (auto-assigned)

## 🔄 Future Updates

Just push to Git, then in cPanel:
- **Update from Remote** → **Deploy HEAD Commit**

## ❗ Important Notes

- ✅ `.cpanel.yml` MUST be committed to Git
- ✅ `.env` should NEVER be committed
- ✅ Update deployment path in `.cpanel.yml` before first deploy
- ✅ Run migrations manually after first deployment
- ✅ Test API endpoints after deployment

For detailed instructions, see `DEPLOYMENT.md` and `CPANEL_SETUP.md`
