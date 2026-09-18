import { Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import UploadAnalysis from './pages/UploadAnalysis';
import Dashboard from './pages/Dashboard';
import RiskAssessment from './pages/RiskAssessment';
import About from './pages/About';

function App() {
  const location = useLocation();

  return (
    <div className="min-h-screen flex flex-col relative text-slate-200">
      <Navbar />
      <main className="flex-grow">
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={<Home />} />
            <Route path="/upload" element={<UploadAnalysis />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/risk-assessment" element={<RiskAssessment />} />
            <Route path="/about" element={<About />} />
          </Routes>
        </AnimatePresence>
      </main>
      
      <footer className="glass-nav py-6 mt-12 text-center text-slate-400 text-sm">
        <div className="container mx-auto px-6 flex flex-col md:flex-row justify-between items-center">
          <p>© 2026 EcoReef-Net. AI-Powered Marine Conservation.</p>
          <div className="flex space-x-4 mt-4 md:mt-0">
            <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-status-healthy"></span> System Online</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
