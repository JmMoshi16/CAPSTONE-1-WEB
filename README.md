# ECOReward Admin Dashboard

A modern, production-ready admin dashboard for the ECOReward Bin IoT waste management system.

## 🚀 Features

- **Real-time Dashboard** - Live waste disposal tracking with linear regression forecasting
- **User Management** - View, search, and analyze customer data with rank badges
- **Rewards & Redemptions** - Full CRUD operations for rewards and redemption tracking
- **QR Generator** - Generate QR codes and paper receipts for customers
- **Bin Management** - Monitor IoT bin fill levels and system health
- **Analytics** - Detailed charts and insights on waste trends
- **Dark Mode UI** - Professional dark theme matching the mobile app

## 🛠️ Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Backend**: Firebase Firestore + Firebase Auth
- **Charts**: Recharts
- **QR Codes**: qrcode.react
- **Notifications**: React Hot Toast

## 📦 Installation

1. **Clone and navigate to the project**
   ```bash
   cd ecoreward-admin-web
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Firebase**
   - Copy `.env.local.example` to `.env.local`
   - Add your Firebase credentials from Firebase Console

4. **Run development server**
   ```bash
   npm run dev
   ```

5. **Open in browser**
   ```
   http://localhost:3000
   ```

## 🔐 Authentication

- Only users with `role: 'admin'` in Firestore can access the dashboard
- Login page redirects non-admin users automatically
- Protected routes with Firebase Auth state management

## 📁 Project Structure

```
ecoreward-admin-web/
├── app/
│   ├── dashboard/          # Main dashboard page
│   ├── analytics/          # Analytics and charts
│   ├── bins/              # IoT bin monitoring
│   ├── users/             # Customer management
│   ├── rewards/           # Rewards & redemptions
│   ├── qr/                # QR code generator
│   ├── settings/          # Settings page
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Login page
├── components/
│   └── Sidebar.tsx        # Navigation sidebar
├── lib/
│   ├── firebase.ts        # Firebase config
│   ├── firebaseService.ts # Firestore operations
│   ├── types.ts           # TypeScript types
│   └── utils.ts           # Helper functions
└── public/                # Static assets
```

## 🎨 Design System

### Colors
- Background: `#0D1117`
- Card: `#161B22`
- Border: `#30363D`
- Primary Green: `#00E676`
- Blue: `#00B0FF`
- Orange: `#FFAB40`
- Purple: `#B388FF`

### Components
- Cards: 20px border radius
- Buttons: 14px border radius
- Chips: 20px border radius

## 🔥 Firebase Collections

### users
```typescript
{
  uid: string
  username: string
  email: string
  role: 'customer' | 'admin'
  points: number
  createdAt: string
}
```

### waste_logs
```typescript
{
  userId: string
  wasteType: 'Biodegradable' | 'Recyclable' | 'Residual'
  pointsEarned: number
  timestamp: string
  binId: string
}
```

### rewards
```typescript
{
  title: string
  description: string
  pointsCost: number
  category: 'Coffee' | 'Food' | 'Discount' | 'Other'
  isActive: boolean
}
```

### redemptions
```typescript
{
  userId: string
  userEmail: string
  rewardId: string
  rewardTitle: string
  pointsUsed: number
  redeemedAt: string
  status: 'pending' | 'claimed'
  redemptionCode: string
}
```

### qr_tokens
```typescript
{
  token: string
  wasteType: string
  expiresAt: string
  usedBy: string[]
  createdAt: string
}
```

## 📊 Key Features

### Dashboard
- Real-time stat cards (disposals, customers, points, redemptions)
- 7-day waste volume chart with linear regression forecast
- Peak disposal hours analysis
- Most common waste type tracking
- Analytics overview grid with mini charts

### Users
- Search and sort functionality
- Rank badges (Bronze/Silver/Gold/Platinum)
- User detail drawer with waste breakdown
- CSV export

### Rewards & Redemptions
- Add/Edit/Delete rewards
- Active/Inactive toggle
- Pending vs Claimed redemption tracking
- Mark as claimed functionality
- CSV export

### QR Generator
- QR Code mode with countdown timer
- Paper Receipt mode with printable design
- 20-minute expiry
- Waste type selection

### Bin Management
- Real-time fill level monitoring
- Color-coded status (green/orange/red)
- Online/Offline status
- System health panel

## 🚀 Deployment

### Vercel (Recommended)
```bash
npm run build
vercel --prod
```

### Other Platforms
```bash
npm run build
npm start
```

## 📝 Environment Variables

Required variables in `.env.local`:
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

## 🤝 Contributing

This is a capstone project for ECOReward Bin IoT waste management system.

## 📄 License

Private - Educational Project

## 👥 Team

ECOReward Bin Development Team

---

Built with ❤️ for a sustainable future 🌍
