# Almost Adult - Your Personal Life Support App

A modern, mobile-first personal productivity and wellness application built with React and TypeScript. Almost Adult helps you manage your daily tasks, shopping lists, workout routines, and menstrual cycles—all in one beautiful, responsive app optimized for iOS and Android.

Because adulting is hard, but you're getting there! 🎯

## ✨ Features

### 📝 Reminders & Tasks
- Create and manage daily tasks, events, and reminders with a visual calendar
- Set priorities (low, medium, high) with color coding
- Recurring tasks (daily, weekly, monthly, yearly) with smart scheduling
- Calendar view with intuitive date navigation
- Overdue task detection - automatically moves incomplete tasks to today
- Quick categories (Birthday, Medicine, Workout, Call, Work, Home)
- Time-based reminders with native formatting
- Empty state guidance for new users

### 🛒 Shopping Lists
- Build and maintain shopping lists by store (FreshCo, Costco, Amazon, etc.)
- Share lists with family members (bidirectional sharing)
- Track who added/completed items with user attribution
- Comprehensive audit history of all changes
- Bulk clear completed items
- Collaborative shopping experience
- Real-time updates across shared users

### 💪 Workout Tracker
- Custom workout splits (Chest/Tri, Back/Bi, Shoulders, Legs/Core, etc.)
- Log exercises with sets, reps, and weight PRs
- Track personal records automatically with visual indicators
- Visual workout summary with total volume calculations
- Color-coded body part organization (customizable)
- Easy exercise management with inline editing
- Empty state with setup guidance

### 🩸 Period Tracker
- Track menstrual cycles with start/end dates
- Automatic cycle predictions based on personal history
- Visual calendar with period days highlighted
- Customizable settings (cycle length, period length)
- Smart notifications before predicted periods
- Detailed cycle history with statistics

### ⚙️ Configurable Modules
- Enable/disable modules based on your needs
- Personalized app experience
- Clean settings interface with module toggles
- Account management
- At least one module must remain active for functionality

### 🔐 Secure Authentication
- JWT-based authentication with 30-day sessions
- Secure password hashing with bcrypt
- User session management
- Protected API endpoints
- Auto-login with stored credentials

## 📱 Mobile Optimization

- **iOS Safe Area Support**: Proper handling of notches and home indicators
- **Android Navigation**: Adaptive spacing for Android navigation buttons
- **Touch-Optimized**: 44px minimum touch targets for accessibility
- **Responsive FAB**: Floating Action Button positioned above navigation
- **Smooth Animations**: Native-feeling transitions and interactions
- **Pull-to-Refresh Protection**: Prevents accidental page reloads
- **Optimized Modals**: Bottom sheet design with proper footer spacing
- **No Unnecessary Scrolling**: Compact layouts that fit viewport

## 🛠 Tech Stack

### Frontend
- **Framework**: React 18 with TypeScript
- **Routing**: React Router v6 with protected routes
- **Icons**: React Icons (Ionicons 5)
- **Styling**: Custom CSS with mobile-first responsive design
- **State Management**: React Hooks & Context API (AuthContext)
- **Build Tool**: Vite 5 with TypeScript compilation
- **Date Handling**: date-fns for efficient date operations

### Backend
- **Platform**: Vercel Serverless Functions (optimized for Hobby plan)
- **Database**: Neon PostgreSQL (serverless Postgres)
- **Authentication**: JWT with bcrypt (10 rounds)
- **API**: Single consolidated REST API endpoint
- **Type Safety**: Full TypeScript coverage

### Development Features
- **Hot Module Replacement**: Instant updates during development
- **TypeScript**: Full type safety across frontend and backend
- **Modern CSS**: Flexbox, CSS Grid, CSS Variables
- **Custom Hooks**: Reusable logic (useModal, useList)
- **Component Library**: Shared components (Modal, FAB, FormControls, EmptyState)

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn
- Neon PostgreSQL account (for production)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd mylife-web
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
Create a `.env` file in the root directory:
```env
DATABASE_URL=your_neon_postgres_url
JWT_SECRET=your_secret_key_here
```

4. Initialize the database:
Visit `/api/init` after deployment or run locally to create tables

5. Start the development server:
```bash
npm run dev
```

6. Open your browser and navigate to `http://localhost:5173`

## 📁 Project Structure

```
mylife-web/
├── api/
│   ├── index.ts          # Consolidated API handler (single serverless function)
│   └── db.ts             # Database helpers and initialization
├── src/
│   ├── components/       # Reusable React components
│   ├── contexts/         # React Context providers (Auth)
│   ├── hooks/            # Custom React hooks
│   ├── pages/            # Page components
│   │   ├── AuthPage.tsx
│   │   ├── TodoPage.tsx
│   │   ├── ShoppingPage.tsx
│   │   ├── WorkoutPage.tsx
│   │   ├── PeriodPage.tsx
│   │   └── SettingsPage.tsx
│   ├── styles/           # Global styles
│   ├── types/            # TypeScript interfaces
│   ├── utils/            # Utility functions (API, storage, theme)
│   └── App.tsx           # Main app component
├── public/               # Static assets
└── vercel.json           # Vercel deployment configuration
```

## 📜 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## 🗄️ Database Schema

The app uses PostgreSQL with the following main tables:
- `users` - User accounts
- `todos` - Tasks and reminders
- `shopping_items` - Shopping list items
- `shopping_shares` - List sharing relationships
- `shopping_audit` - Change history
- `exercises` - Workout exercises
- `body_parts` - Custom workout splits
- `period_cycles` - Menstrual cycle records
- `period_settings` - Period tracking preferences
- `user_settings` - Module configuration

## 🌐 Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Import project in Vercel
3. Add environment variables (DATABASE_URL, JWT_SECRET)
4. Deploy
5. Visit `/api/init` to initialize database

**Note**: The API has been optimized to use only 1 serverless function, staying within Vercel's Hobby plan limit of 12 functions.

## 📱 Browser Support & Mobile Features

### Supported Platforms
- **iOS Safari**: Full support with safe area insets (notch/home indicator)
- **Android Chrome**: Optimized for navigation button spacing
- **Desktop Browsers**: Chrome, Firefox, Safari, Edge (latest versions)
- **Progressive Web App**: Can be installed on home screen

### Mobile Enhancements
- Adaptive bottom navigation with safe area support
- Touch-optimized 44px minimum tap targets
- No zoom on input focus (iOS)
- Pull-to-refresh disabled to prevent interference
- Smooth scrolling with `-webkit-overflow-scrolling: touch`
- Optimized modal layouts (bottom sheets on mobile)
- Responsive FAB positioning above navigation

### Responsive Design
- Mobile-first approach (320px - 500px)
- Tablet optimization (768px - 900px)
- Desktop layouts (1024px+)
- Flexible max-width containers
- Adaptive font sizes and spacing

## 🎨 Customization

- Module system allows enabling/disabling features
- Color-coded body parts in workout tracker
- Customizable shopping categories
- Flexible notification settings
- Personalized user experience

## 🔒 Security

- Passwords hashed with bcrypt (10 rounds)
- JWT tokens with 30-day expiration
- Server-side authentication on all protected routes
- SQL injection protection with parameterized queries

## 📝 License

This project is licensed under the MIT License.

## 👨‍💻 Author

Created with ❤️ for better productivity and wellness management