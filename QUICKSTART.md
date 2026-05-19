# 🚀 Quick Start Guide

## Step 1: Install Dependencies
```bash
npm install
```

## Step 2: Configure Firebase

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your ECOReward project
3. Go to Project Settings > General
4. Copy your Firebase configuration
5. Create `.env.local` file in the root directory:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

## Step 3: Create Admin User

In Firebase Console > Firestore Database, create a user document:

```
Collection: users
Document ID: [your-user-uid]
Fields:
  - username: "Admin"
  - email: "admin@ecoreward.com"
  - role: "admin"  ← IMPORTANT!
  - points: 0
  - createdAt: "2024-01-01T00:00:00.000Z"
```

## Step 4: Run Development Server
```bash
npm run dev
```

## Step 5: Login
- Open http://localhost:3000
- Login with your admin email and password
- You should see the dashboard!

## 🎯 What You'll See

### Dashboard Page
- Real-time statistics
- Waste volume chart with forecasting
- Peak hours and common waste analysis
- Analytics overview grid

### Users Page
- All customers with rank badges
- Search and sort functionality
- User detail drawer
- CSV export

### Rewards & Redemptions
- Manage rewards (add/edit/delete)
- Track redemptions (pending/claimed)
- Mark redemptions as claimed

### QR Generator
- Generate QR codes for customers
- Create paper receipts
- 20-minute expiry timer

### Bin Management
- Monitor bin fill levels
- Check online/offline status
- System health monitoring

### Analytics
- Weekly waste charts
- Points awarded trends
- Top 5 users leaderboard

## 🔧 Troubleshooting

### "Access denied. Admin only."
- Make sure your user document has `role: "admin"` in Firestore

### Firebase errors
- Check that all environment variables are set correctly
- Verify Firebase project is active
- Ensure Firestore rules allow admin access

### Build errors
- Delete `node_modules` and `.next` folders
- Run `npm install` again
- Clear npm cache: `npm cache clean --force`

## 📱 Mobile App Integration

This dashboard works with the ECOReward Flutter mobile app. Make sure:
- Both use the same Firebase project
- Firestore collections match the schema
- QR codes generated here can be scanned by the mobile app

## 🎨 Customization

### Change Colors
Edit `tailwind.config.js`:
```js
colors: {
  green: '#00E676',  // Change primary color
  blue: '#00B0FF',   // Change secondary color
  // ... etc
}
```

### Add New Pages
1. Create folder in `app/` directory
2. Add `page.tsx` file
3. Add route to `Sidebar.tsx`

## 📦 Production Build

```bash
npm run build
npm start
```

## 🚀 Deploy to Vercel

```bash
npm install -g vercel
vercel login
vercel --prod
```

Add environment variables in Vercel dashboard!

---

Need help? Check the full README.md for detailed documentation.
