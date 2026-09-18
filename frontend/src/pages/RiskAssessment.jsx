import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, ShieldCheck, ThermometerSun, Leaf, RefreshCcw } from 'lucide-react';
import axios from 'axios';

const RiskAssessment = () => {  
  const [loading, setLoading] = useState(true);
  const [riskScore, setRiskScore] = useState(0);
  const [riskLevel, setRiskLevel] = useState('Low Risk');

  useEffect(() => {
    const fetchRecords = async () => {
      try {
        const response = await axios.get('/api/records');
        const records = response.data.records || [];
        
        let healthy = 0;
        let bleached = 0;
        let dead = 0;
        
        records.forEach(r => {
          healthy += (r.counts?.healthy || 0);
          bleached += (r.counts?.bleached || 0);
          dead += (r.counts?.dead || 0);
        });
        
        const total = healthy + bleached + dead;
        if (total > 0) {
          const score = ((bleached * 0.5) + (dead * 1.0)) / total;
          setRiskScore(score);
          if (score > 0.6) setRiskLevel('Critical Risk');
          else if (score > 0.3) setRiskLevel('Moderate Risk');
          else setRiskLevel('Low Risk');
        }
      } catch (error) {
        console.error('Failed to fetch records:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchRecords();
  }, []);

  const gaugeRotation = Math.min(180, Math.max(0, riskScore * 180));

  if (loading) {
    return (
      <div className="pt-24 pb-12 flex justify-center items-center min-h-screen text-accent-cyan">
        <RefreshCcw className="w-10 h-10 animate-spin" />
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="pt-24 pb-12 px-6 max-w-4xl mx-auto min-h-screen flex flex-col gap-8"
    >
      <div className="text-center mb-6">
        <h1 className="text-4xl font-bold mb-4">Ecological Risk Assessment</h1>
        <p className="text-slate-400">Automated conservation intelligence based on latest database aggregation.</p>
      </div>

      {/* Hero Metric */}
      <div className="glass-panel p-10 flex flex-col items-center justify-center relative overflow-hidden">
        
        {/* Gauge Background Elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-accent-cyan/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-status-bleached/10 rounded-full blur-3xl -ml-20 -mb-20"></div>

        <h3 className="text-lg text-slate-400 uppercase tracking-widest font-semibold mb-8">System Threat Level</h3>

        {/* Semi-circle Gauge */}
        <div className="relative w-[300px] h-[150px] overflow-hidden mb-6">
          <div className="absolute w-[300px] h-[300px] rounded-full border-[15px] border-slate-700 box-border"></div>
          
          <div className="absolute w-[300px] h-[300px] rounded-full border-[15px] border-transparent border-t-status-healthy border-l-status-healthy/50 box-border rotate-45"></div>
          <div className="absolute w-[300px] h-[300px] rounded-full border-[15px] border-transparent border-t-status-bleached border-l-transparent box-border rotate-[135deg]"></div>
          <div className="absolute w-[300px] h-[300px] rounded-full border-[15px] border-transparent border-t-status-dead border-l-transparent box-border rotate-[225deg] border-r-transparent"></div>
          
          {/* Needle */}
          <div 
            className="absolute bottom-0 left-[50%] w-2 h-[130px] bg-white origin-bottom rounded-t-full transition-transform duration-1000 ease-out"
            style={{ transform: `translateX(-50%) rotate(${gaugeRotation - 90}deg)` }}
          >
            <div className="absolute -bottom-2 -left-2 w-6 h-6 rounded-full bg-accent-cyan shadow-[0_0_10px_rgba(0,240,255,0.8)] border-4 border-ocean-900"></div>
          </div>
        </div>

        <div className="text-4xl font-display font-bold text-amber-400 mb-2">{riskLevel}</div>
        <div className="text-slate-400 font-mono tracking-widest text-sm">INDEX: {riskScore.toFixed(3)}</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Formula Breakdown */}
        <div className="glass-panel p-8">
          <h3 className="text-xl font-bold flex items-center gap-3 mb-6">
            <ThermometerSun className="text-accent-teal" /> Mathematics
          </h3>
          <p className="text-sm text-slate-400 mb-6 leading-relaxed">
            The Ecological Risk Index (0.0 to 1.0) calculates severity based on population ratios. Dead coral carries a 1.0 weight, while bleached coral carries a 0.5 weight.
          </p>
          
          <div className="bg-ocean-900/80 p-4 rounded-xl border border-ocean-700 font-mono text-sm text-center shadow-inner overflow-x-auto text-slate-300">
            <span className="text-accent-cyan">Index</span> = (
              <span className="text-amber-400">Bleached</span>×0.5 + <span className="text-red-400">Dead</span>×1.0
            ) / <span className="text-emerald-400">Total_Population</span>
          </div>
          
          <div className="mt-6 flex flex-col gap-3">
            <div className="flex justify-between text-sm border-b border-ocean-700 pb-2">
              <span className="text-emerald-400">Low Risk</span><span>0.00 - 0.30</span>
            </div>
            <div className="flex justify-between text-sm border-b border-ocean-700 pb-2">
              <span className="text-amber-400">Moderate Risk</span><span>0.31 - 0.60</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-red-400">Critical Risk</span><span>0.61 - 1.00</span>
            </div>
          </div>
        </div>

        {/* AI Recommendations */}
        <div className="glass-panel p-8">
          <h3 className="text-xl font-bold flex items-center gap-3 mb-6">
            <ShieldCheck className="text-accent-cyan" /> AI Recommendations
          </h3>
          
          <div className="space-y-4">
            <div className="flex gap-4 p-4 rounded-xl bg-orange-900/20 border border-orange-500/30">
              <AlertTriangle className="text-orange-500 shrink-0 w-6 h-6" />
              <div>
                <h4 className="font-semibold text-orange-200 mb-1">Diver Intervention Required</h4>
                <p className="text-sm text-slate-400">Elevated bleaching indicates potential thermal stress. Schedule physical water temperature and salinity sampling.</p>
              </div>
            </div>

            <div className="flex gap-4 p-4 rounded-xl bg-emerald-900/20 border border-emerald-500/30">
              <Leaf className="text-emerald-500 shrink-0 w-6 h-6" />
              <div>
                <h4 className="font-semibold text-emerald-200 mb-1">Ecological Fencing</h4>
                <p className="text-sm text-slate-400">Implement temporary tourist/diving restrictions around coordinates showing &gt;30% bleaching to reduce mechanical stress.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default RiskAssessment;
