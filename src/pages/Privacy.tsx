import React from 'react';
import { Helmet } from 'react-helmet';

const Privacy = () => {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Helmet>
        <title>Privacy Policy | F1 DataStop</title>
        <meta name="description" content="F1 DataStop privacy policy and data collection practices" />
      </Helmet>
      
      <h1 className="text-3xl font-bold mb-6">Privacy Policy</h1>
      
      <div className="prose prose-lg max-w-none">
        <p className="text-lg mb-4">
          Last updated: {new Date().toLocaleDateString()}
        </p>
        
        <h2 className="text-2xl font-semibold mt-8 mb-4">Introduction</h2>
        <p>
          F1 DataStop ("we", "our", or "us") is committed to protecting your privacy. 
          This Privacy Policy explains how we collect, use, and share information about you when you use our website.
        </p>
        
        <h2 className="text-2xl font-semibold mt-8 mb-4">Information We Collect</h2>
        <p>
          We collect information about you in various ways when you use our website:
        </p>
        <ul className="list-disc pl-6 mt-2 mb-6">
          <li>Information you provide directly to us, such as when you create an account or contact us</li>
          <li>Information we collect automatically when you use our site, including usage data, device information, and cookies</li>
          <li>Information from third parties, where permitted by law</li>
        </ul>
        
        <h2 className="text-2xl font-semibold mt-8 mb-4">User Analytics and Microsoft Clarity</h2>
        <div className="bg-gray-100 p-6 rounded-lg mb-6">
          <p className="mb-4">
            We partner with Microsoft Clarity and Microsoft Advertising to capture how you use and interact with our website through behavioral metrics, heatmaps, and session replay to improve and market our products/services. Website usage data is captured using first and third-party cookies and other tracking technologies to determine the popularity of products/services and online activity. Additionally, we use this information for site optimization, fraud/security purposes, and advertising. For more information about how Microsoft collects and uses your data, visit the <a href="https://privacy.microsoft.com/en-us/privacystatement" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Microsoft Privacy Statement</a>.
          </p>
        </div>
        
        <h2 className="text-2xl font-semibold mt-8 mb-4">How We Use Your Information</h2>
        <p>
          We use the information we collect to:
        </p>
        <ul className="list-disc pl-6 mt-2 mb-6">
          <li>Provide, maintain, and improve our services</li>
          <li>Understand how users interact with our website (through tools like Microsoft Clarity)</li>
          <li>Personalize your experience and deliver content relevant to your interests</li>
          <li>Respond to your comments, questions, and requests</li>
          <li>Send you technical notices, updates, security alerts, and support messages</li>
          <li>Monitor and analyze trends, usage, and activities in connection with our services</li>
          <li>Detect, investigate, and prevent fraudulent transactions and other illegal activities</li>
        </ul>
        
        <h2 className="text-2xl font-semibold mt-8 mb-4">Cookies and Other Tracking Technologies</h2>
        <p>
          We and our partners use cookies and similar technologies to collect information about your interactions with our website.
          You can control or reject cookies through your browser settings, although this may limit your ability to use certain features of our site.
        </p>
        
        <h2 className="text-2xl font-semibold mt-8 mb-4">Your Rights and Choices</h2>
        <p>
          Depending on your location, you may have certain rights regarding your personal information, including:
        </p>
        <ul className="list-disc pl-6 mt-2 mb-6">
          <li>Access to your personal information</li>
          <li>Correction of inaccurate or incomplete information</li>
          <li>Deletion of your personal information</li>
          <li>Restriction or objection to certain processing activities</li>
          <li>Data portability</li>
          <li>Withdrawal of consent</li>
        </ul>
        
        <h2 className="text-2xl font-semibold mt-8 mb-4">Contact Us</h2>
        <p>
          If you have any questions about this Privacy Policy or our data practices, please contact us at:
          <br />
          <br />
          <strong>Email:</strong> admin@f1datastop.com
        </p>
      </div>
    </div>
  );
};

export default Privacy; 