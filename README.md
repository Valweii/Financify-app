# Financify 💰

A modern, secure personal finance management application with end-to-end encryption, intelligent bank statement parsing, and collaborative bill splitting features.

![Financify Hero](src/assets/financify-hero.jpg)

## ✨ Features

### 🔐 **End-to-End Encryption**
- **AES-GCM 256-bit encryption** for all financial data
- **PBKDF2 key derivation** with 100,000 iterations
- **Backup codes** for cross-device recovery
- **Device-local key caching** for convenience
- **Zero-knowledge architecture** - your data is encrypted before leaving your device

### 📊 **Smart Financial Dashboard**
- **Real-time balance tracking** with animated counters
- **Interactive cash flow charts** with monthly/yearly views
- **Income vs expense analytics** with visual trends
- **Recent transaction overview** with smart categorization
- **Responsive design** optimized for mobile and desktop

### 🏦 **Intelligent Bank Statement Import**
- **BCA PDF parser** with advanced text extraction
- **OCR fallback** using Tesseract.js for image-based statements
- **Automatic transaction detection** with amount and date parsing
- **Indonesian currency format support** (IDR)
- **Multi-line transaction handling** for complex statements

### 🧾 **Smart Bill Splitting**
- **Receipt OCR** for automatic item detection
- **Visual item assignment** with drag-and-drop interface
- **Tax and service fee calculation** with percentage-based splitting
- **Real-time cost distribution** among participants
- **Split bill history** with payment tracking
- **Export capabilities** for sharing with friends

### 📱 **Modern User Experience**
- **Mobile-first design** with touch-optimized interactions
- **Smooth animations** and micro-interactions
- **Dark/light theme support** with system preference detection
- **Offline-first architecture** with local data persistence
- **Progressive Web App** capabilities

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Supabase account (for backend services)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/financify.git
   cd financify
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```
   
   Configure your Supabase credentials:
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Set up Supabase database**
   ```bash
   # Install Supabase CLI
   npm install -g supabase
   
   # Initialize and start local Supabase
   supabase init
   supabase start
   
   # Run migrations
   supabase db reset
   ```

5. **Start the development server**
   ```bash
   npm run dev
   # or
   yarn dev
   ```

6. **Open your browser**
   Navigate to `http://localhost:5173`

## 🏗️ Architecture

### Frontend Stack
- **React 18** with TypeScript
- **Vite** for fast development and building
- **Tailwind CSS** for styling
- **Radix UI** for accessible components
- **Zustand** for state management
- **React Query** for server state
- **React Router** for navigation

### Backend & Database
- **Supabase** for authentication and database
- **PostgreSQL** with Row Level Security (RLS)
- **Real-time subscriptions** for live updates

### Security & Encryption
- **Web Crypto API** for client-side encryption
- **AES-GCM 256-bit** encryption algorithm
- **PBKDF2** key derivation with 100,000 iterations
- **Device-local key wrapping** for convenience
- **Backup code system** for recovery

### PDF Processing & OCR
- **PDF.js** for PDF text extraction
- **Tesseract.js** for OCR fallback
- **Custom BCA statement parser** with Indonesian format support

## 📁 Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── ui/             # Base UI components (Radix UI)
│   ├── AuthScreen.tsx  # Authentication interface
│   ├── FinancifyApp.tsx # Main application wrapper
│   └── ...
├── screens/            # Main application screens
│   ├── DashboardScreen.tsx
│   ├── SplitBillScreen.tsx
│   ├── ReportsScreen.tsx
│   └── SettingsScreen.tsx
├── lib/                # Core utilities and parsers
│   ├── encryption.ts   # End-to-end encryption utilities
│   ├── bca-pdf-parser.ts # Bank statement parser
│   ├── receipt-ocr.ts  # Receipt OCR processing
│   └── utils.ts        # General utilities
├── hooks/              # Custom React hooks
├── store/              # Zustand state management
├── integrations/       # External service integrations
│   └── supabase/       # Supabase client and types
└── pages/              # Route components
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_SUPABASE_URL` | Your Supabase project URL | Yes |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anonymous key | Yes |

### Database Schema

The application uses the following main tables:

- **`profiles`** - User profile information
- **`transactions`** - Financial transactions (with encryption support)
- **`split_bill_history`** - Bill splitting records
- **`backup_codes`** - Encrypted backup codes for key recovery

## 🛡️ Security Features

### Data Encryption
- All sensitive financial data is encrypted using AES-GCM 256-bit encryption
- Encryption keys are derived from user passwords using PBKDF2
- Data is encrypted client-side before being sent to the server
- Server never has access to unencrypted financial data

### Authentication & Authorization
- Supabase Auth for secure user authentication
- Row Level Security (RLS) policies for data access control
- JWT-based session management
- Automatic session refresh and validation

### Privacy Protection
- Zero-knowledge architecture
- Local key caching with device-specific wrapping
- Backup code system for secure key recovery
- No third-party analytics or tracking

## 📱 Mobile Support

Financify is designed as a Progressive Web App (PWA) with:
- **Responsive design** that works on all screen sizes
- **Touch-optimized interactions** for mobile devices
- **Offline capabilities** with local data caching
- **App-like experience** with smooth animations
- **Installable** on mobile home screens

### Code Style
- Use TypeScript for all new code
- Follow the existing ESLint configuration
- Use Prettier for code formatting
- Write meaningful commit messages

---

**Made with ❤️ for secure personal finance management**