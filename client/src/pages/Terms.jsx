import { Link } from 'react-router-dom';
import './Privacy.css';

export default function Terms() {
  return (
    <div className="legal-page">
      <div className="legal-container">
        <nav className="breadcrumb">
          <Link to="/products">Home</Link>
          <span className="breadcrumb-sep">/</span>
          <span className="breadcrumb-current">Terms of Service</span>
        </nav>

        <h1>Terms of Service</h1>
        <p className="legal-updated">Last updated: January 1, 2025</p>

        <section>
          <h2>1. Acceptance of Terms</h2>
          <p>
            By accessing or using ShopEase, you agree to be bound by these Terms of Service.
            If you do not agree to all of these terms, you may not use our services.
          </p>
        </section>

        <section>
          <h2>2. Accounts</h2>
          <p>
            You are responsible for maintaining the confidentiality of your account credentials
            and for all activities that occur under your account. You agree to provide accurate
            and complete information when creating an account.
          </p>
        </section>

        <section>
          <h2>3. Orders and Payments</h2>
          <p>
            All orders are subject to availability. We reserve the right to cancel any order
            for any reason. Prices for our products are subject to change without notice, and
            payments are processed securely through our payment providers.
          </p>
        </section>

        <section>
          <h2>4. Returns and Refunds</h2>
          <p>
            Certain items may be eligible for return within 30 days of delivery. Items must be
            unused and in their original packaging. Refunds will be issued to the original
            payment method after inspection.
          </p>
        </section>

        <section>
          <h2>5. Prohibited Conduct</h2>
          <p>You agree not to:</p>
          <ul>
            <li>Use the service for any unlawful purpose</li>
            <li>Attempt to interfere with the proper working of the service</li>
            <li>Impersonate any person or misrepresent your identity</li>
            <li>Collect personal information of other users</li>
          </ul>
        </section>

        <section>
          <h2>6. Limitation of Liability</h2>
          <p>
            ShopEase shall not be liable for any indirect, incidental, or consequential damages
            arising out of your use of the service. Our total liability shall not exceed the
            amount paid by you for the products in question.
          </p>
        </section>

        <section>
          <h2>7. Contact Us</h2>
          <p>
            If you have any questions about these Terms of Service, please contact us at
            support@shopease.com.
          </p>
        </section>
      </div>
    </div>
  );
}
