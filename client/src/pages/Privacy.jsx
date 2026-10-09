import { Link } from 'react-router-dom';
import './Privacy.css';

export default function Privacy() {
  return (
    <div className="legal-page">
      <div className="legal-container">
        <nav className="breadcrumb">
          <Link to="/products">Home</Link>
          <span className="breadcrumb-sep">/</span>
          <span className="breadcrumb-current">Privacy Policy</span>
        </nav>

        <h1>Privacy Policy</h1>
        <p className="legal-updated">Last updated: January 1, 2025</p>

        <section>
          <h2>1. Information We Collect</h2>
          <p>
            We collect information you provide directly to us, such as when you create an
            account, place an order, or contact customer support. This may include your
            name, email address, shipping address, and payment information.
          </p>
        </section>

        <section>
          <h2>2. How We Use Your Information</h2>
          <p>We use the information we collect to:</p>
          <ul>
            <li>Process and fulfill your orders</li>
            <li>Communicate with you about your orders and account</li>
            <li>Improve our products and services</li>
            <li>Detect and prevent fraud</li>
          </ul>
        </section>

        <section>
          <h2>3. Information Sharing</h2>
          <p>
            We do not sell your personal information. We may share your information with
            trusted service providers who assist us in operating our store, processing
            payments, and delivering orders.
          </p>
        </section>

        <section>
          <h2>4. Data Security</h2>
          <p>
            We implement appropriate security measures to protect your personal
            information. However, no method of transmission over the Internet is
            completely secure.
          </p>
        </section>

        <section>
          <h2>5. Contact Us</h2>
          <p>
            If you have any questions about this Privacy Policy, please contact us at
            support@shopease.com.
          </p>
        </section>
      </div>
    </div>
  );
}
