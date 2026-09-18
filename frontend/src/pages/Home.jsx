import { motion } from 'framer-motion';
import { NavLink } from 'react-router-dom';
import { ArrowRight, BarChart3, Crosshair, Zap } from 'lucide-react';

const Home = () => {
  return (
    <div className="pt-24 pb-12 w-full flex flex-col items-center">
      {/* Hero Section */}
      <section className="relative w-full max-w-7xl mx-auto px-6 py-20 flex flex-col items-center text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-ocean-700 bg-ocean-800/50 mb-8 text-sm font-medium text-accent-cyan">
            <span className="w-2 h-2 rounded-full bg-accent-cyan animate-pulse"></span>
            AI-Powered Marine Conservation
          </div>
          
          <h1 className="text-5xl md:text-7xl font-extrabold mb-6 leading-tight">
            Protecting Coral Reefs <br />
            with <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent-cyan to-accent-teal">Deep Learning</span>
          </h1>
          
          <p className="text-lg md:text-xl text-slate-400 max-w-3xl mx-auto mb-10 leading-relaxed">
            EcoReef-Net autonomously monitors underwater ecosystems using CLAHE visibility enhancement and Faster R-CNN object detection to assess coral bleaching and ecological risks in real-time.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <NavLink to="/upload" className="btn-primary group flex items-center justify-center gap-2">
              Start Analysis
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </NavLink>
            <NavLink to="/dashboard" className="btn-secondary">
              View Dashboard
            </NavLink>
          </div>
        </motion.div>
      </section>

      {/* Feature Highlights */}
      <section className="w-full max-w-7xl mx-auto px-6 py-20 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="glass-panel p-8 hover:-translate-y-2 transition-transform duration-300"
          >
            <div className="w-12 h-12 rounded-xl bg-ocean-800 border border-ocean-700 flex items-center justify-center mb-6 text-accent-cyan">
              <Zap className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold mb-3">OpenCV CLAHE</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Enhances underwater visibility by cutting through blue-green cast and backscattering noise using advanced Contrast Limited Adaptive Histogram Equalization.
            </p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="glass-panel p-8 hover:-translate-y-2 transition-transform duration-300"
          >
            <div className="w-12 h-12 rounded-xl bg-ocean-800 border border-ocean-700 flex items-center justify-center mb-6 text-accent-teal">
              <Crosshair className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold mb-3">Faster R-CNN Detection</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Powerful ResNet-50 backbone detects and categorizes coral heads into Healthy, Bleached, and Dead classes with high precision.
            </p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className="glass-panel p-8 hover:-translate-y-2 transition-transform duration-300"
          >
            <div className="w-12 h-12 rounded-xl bg-ocean-800 border border-ocean-700 flex items-center justify-center mb-6 text-emerald-400">
              <BarChart3 className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold mb-3">Real-time Risk Mapping</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Aggregates inference data into a comprehensive risk scoring system to provide actionable automated conservation recommendations.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Metrics Preview */}
      <section className="w-full max-w-7xl mx-auto px-6 py-12">
        <div className="glass-panel p-8 md:p-12 border-l-4 border-l-accent-cyan">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-4xl font-display font-bold text-white mb-2">98.5%</div>
              <div className="text-xs tracking-wider text-slate-400 uppercase">Detection Accuracy</div>
            </div>
            <div>
              <div className="text-4xl font-display font-bold text-accent-cyan mb-2">~35ms</div>
              <div className="text-xs tracking-wider text-slate-400 uppercase">Inference Speed</div>
            </div>
            <div>
              <div className="text-4xl font-display font-bold text-accent-teal mb-2">3 Classes</div>
              <div className="text-xs tracking-wider text-slate-400 uppercase">Health Categories</div>
            </div>
            <div>
              <div className="text-4xl font-display font-bold text-status-bleached mb-2">Real-time</div>
              <div className="text-xs tracking-wider text-slate-400 uppercase">Risk Assessment</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
