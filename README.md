# Almost Adult - Your Personal Life Support App

A modern, intuitive personal productivity and wellness application built with React and TypeScript. Almost Adult helps you manage your daily tasks, shopping lists, workout routines, and menstrual cycles—all in one beautiful, configurable app.

Because adulting is hard, but you're getting there! 🎯

## ✨ Features

### 📝 Reminders & Tasks
- Create and manage daily tasks, events, and reminders
- Set priorities (low, medium, high)
- Recurring tasks (daily, weekly, monthly, yearly)
- Calendar view with date navigation
- Mark tasks as complete
- Time-based reminders

### 🛒 Shopping Lists
- Build and maintain shopping lists by store (FreshCo, Costco, Amazon, etc.)
- Share lists with family members (bidirectional sharing)
- Track who added/completed items
- Audit history of all changes
- Bulk clear completed items
- Collaborative shopping experience

### 💪 Workout Tracker
- Custom workout splits (Chest/Tri, Back/Bi, Shoulders, Legs/Core, etc.)
- Log exercises with sets, reps, and weight PRs
- Track personal records automatically
- Visual workout summary with total volume
- Color-coded body part organization
- Easy exercise management

### 🩸 Period Tracker
- Track menstrual cycles with start/end dates
- Automatic cycle predictions based on history
- Visual calendar with period days highlighted
- Customizable settings (cycle length, period length)
- Smart notifications before predicted periods
- Detailed cycle history

### ⚙️ Configurable Modules
- Enable/disable modules based on your needs
- Personalized app experience
- Clean settings interface
- Account management
- At least one module must remain active

### 🔐 Secure Authentication
- JWT-based authentication
- Secure password hashing with bcrypt
- User session management
- Protected API endpoints

## 🛠 Tech Stack

### Frontend
- **Framework**: React 18 with TypeScript
- **Routing**: React Router v6
- **Icons**: React Icons (Ionicons 5)
- **Styling**: Custom CSS with responsive design
- **State Management**: React Hooks & Context API
- **Build Tool**: Vite

### Backend
- **Platform**: Vercel Serverless Functions
- **Database**: Neon PostgreSQL (serverless)
- **Authentication**: JWT with bcrypt
- **API**: Single consolidated REST API (optimized for Vercel Hobby plan)

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

## 📱 Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- Mobile responsive design
- iOS and Android compatible
- PWA-ready architecture

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