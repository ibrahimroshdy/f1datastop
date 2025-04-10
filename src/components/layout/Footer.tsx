import { Link } from 'react-router-dom';

const Footer = () => {
  return (
    <footer className="bg-gray-900 text-white py-8 mt-auto">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h3 className="text-xl font-bold mb-4">F1 DataStop</h3>
            <p className="text-gray-300">
              The ultimate destination for Formula 1 statistics, live race data, and analytics.
            </p>
          </div>
          <div>
            <h3 className="text-xl font-bold mb-4">Quick Links</h3>
            <ul className="space-y-2">
              <li><Link to="/" className="text-gray-300 hover:text-white">Home</Link></li>
              <li><Link to="/calendar" className="text-gray-300 hover:text-white">Race Calendar</Link></li>
              <li><Link to="/drivers" className="text-gray-300 hover:text-white">Drivers</Link></li>
              <li><Link to="/constructors" className="text-gray-300 hover:text-white">Constructors</Link></li>
              <li><Link to="/analytics" className="text-gray-300 hover:text-white">Analytics</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="text-xl font-bold mb-4">Legal</h3>
            <ul className="space-y-2">
              <li><Link to="/terms" className="text-gray-300 hover:text-white">Terms of Service</Link></li>
              <li><Link to="/privacy" className="text-gray-300 hover:text-white">Privacy Policy</Link></li>
              <li><Link to="/cookie-policy" className="text-gray-300 hover:text-white">Cookie Policy</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-gray-800 mt-6 pt-6 text-gray-400 text-sm">
          <div className="flex flex-col md:flex-row justify-between">
            <p>&copy; {new Date().getFullYear()} F1 DataStop. All rights reserved.</p>
            <p className="mt-2 md:mt-0">
              We improve our products and advertising by using Microsoft Clarity to see how you use our website. 
              By using our site, you agree that we and Microsoft can collect and use this data. 
              Our <Link to="/privacy" className="underline hover:text-white">privacy statement</Link> has more details.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer; 