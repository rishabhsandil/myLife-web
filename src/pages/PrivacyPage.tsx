import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './PrivacyPage.css';

export default function PrivacyPage() {
  const { user } = useAuth();

  return (
    <div className="privacy-page">
      <div className="privacy-container">
        <div className="privacy-nav">
          <Link to={user ? '/' : '/auth'} className="privacy-back">
            ← Back to Almost Adult
          </Link>
        </div>

        <h1 className="privacy-title">Privacy Policy</h1>
        <p className="privacy-meta">Effective date: May 15, 2026</p>

        <p>
          Almost Adult ("we", "us") operates the Almost Adult app and website at{' '}
          <a href="https://almost-adult.com">almost-adult.com</a>. This policy
          explains what data we collect, why we collect it, and your rights.
        </p>

        <h2>1. Information we collect</h2>

        <h3>Account data</h3>
        <p>
          When you sign up, we collect your name, email address, and a
          bcrypt-hashed password. We never store your password in plain text.
        </p>

        <h3>Content you create</h3>
        <p>
          We store the data you add to the app: tasks, shopping list items,
          workout sessions (exercises, sets, reps, weights), notes, and recipes.
          All of this is tied to your account.
        </p>

        <h3>Connections and sharing</h3>
        <p>
          If you connect with another user, their name and email are visible to
          you (and yours to them) to support shared shopping lists and task
          assignment. You control who you connect with, and you can remove
          connections at any time from Settings.
        </p>

        <h3>Usage data</h3>
        <p>
          We do not use analytics or tracking SDKs. Standard server access logs
          (IP address, request path, timestamp) are retained by our hosting
          provider, Vercel, per their infrastructure logging policy.
        </p>

        <h2>2. How we use your data</h2>
        <ul>
          <li>To provide the app and sync your data across devices.</li>
          <li>To authenticate your identity and keep your account secure.</li>
          <li>
            To send transactional emails you request — account verification,
            password resets, and shared-list invitations. We do not send
            marketing emails.
          </li>
          <li>
            When you save a recipe using the YouTube auto-fill feature, we send
            only the video URL to OpenAI to extract recipe details. No other
            personal information is included in that request.
          </li>
        </ul>

        <h2>3. Data sharing</h2>
        <p>
          We do not sell your data. We share data only with the providers
          necessary to run the app:
        </p>
        <ul>
          <li>
            <strong>Vercel</strong> — serverless hosting.{' '}
            <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer">
              Privacy policy
            </a>
          </li>
          <li>
            <strong>Neon</strong> — Postgres database hosting.{' '}
            <a href="https://neon.tech/privacy" target="_blank" rel="noopener noreferrer">
              Privacy policy
            </a>
          </li>
          <li>
            <strong>Resend</strong> — transactional email delivery.{' '}
            <a href="https://resend.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer">
              Privacy policy
            </a>
          </li>
          <li>
            <strong>OpenAI</strong> — AI recipe extraction (YouTube URLs only).{' '}
            <a href="https://openai.com/policies/privacy-policy" target="_blank" rel="noopener noreferrer">
              Privacy policy
            </a>
          </li>
        </ul>
        <p>
          Each provider receives only the minimum data needed to perform their
          function. None of them receive your full content or account details
          beyond what is strictly necessary.
        </p>

        <h2>4. Data retention and deletion</h2>
        <p>
          Your data is kept for as long as your account is active. You can
          permanently delete your account from Settings → Delete account. This
          removes all your data from our database. Deletion is irreversible.
        </p>

        <h2>5. Security</h2>
        <p>
          We use bcrypt for password hashing, short-lived JWT access tokens held
          only in memory, long-lived refresh tokens stored in httpOnly cookies,
          and HTTPS for all data in transit.
        </p>

        <h2>6. Children</h2>
        <p>
          Almost Adult is not directed at children under 13. We do not knowingly
          collect personal information from anyone under 13. If you believe a
          child has created an account, contact us and we will delete it.
        </p>

        <h2>7. Changes to this policy</h2>
        <p>
          If we make meaningful changes to this policy, we will update the
          effective date at the top. Continued use of the app after changes take
          effect constitutes acceptance of the updated policy.
        </p>

        <h2>8. Contact</h2>
        <p>
          Questions about this policy?{' '}
          <a href="mailto:privacy@almost-adult.com">privacy@almost-adult.com</a>
        </p>
      </div>
    </div>
  );
}
