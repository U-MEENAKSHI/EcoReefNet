import { motion } from 'framer-motion';

const About = () => {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="pt-24 pb-20 px-6 max-w-4xl mx-auto min-h-screen flex flex-col gap-10"
    >
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-4">Core Architecture</h1>
        <p className="text-slate-400 text-lg max-w-2xl mx-auto">
          EcoReef-Net represents a fusion of modern web infrastructure and advanced computer vision, engineered for marine conservation at scale.
        </p>
      </div>

      <div className="glass-panel p-8 md:p-12 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-br from-accent-cyan/5 to-transparent pointer-events-none"></div>
        <h3 className="text-2xl font-bold mb-6 text-white border-b border-ocean-700 pb-4">Mission Statement</h3>
        <p className="text-slate-300 leading-relaxed text-lg mb-4">
          To combat the accelerating degradation of global coral reefs using autonomous, AI-driven ecological monitoring.
        </p>
        <p className="text-slate-400 leading-relaxed text-sm">
          Traditional marine biology relies on manual diver surveys, which are slow and unscalable. EcoReef-Net automates the visual analysis pipeline, instantly transforming underwater imagery into actionable ecological metrics.
        </p>
      </div>

      <div className="glass-panel p-8 md:p-12">
        <h3 className="text-2xl font-bold mb-8 text-white">Inference Pipeline</h3>
        
        {/* Visual Pipeline representation */}
        <div className="flex flex-col md:flex-row items-center gap-4 text-center font-mono text-sm overflow-x-auto pb-4">
          
          <div className="bg-ocean-800 border border-ocean-700 p-4 rounded-xl min-w-[140px]">
            Input Image<br/>(Raw / Turbid)
          </div>
          
          <div className="text-accent-cyan shrink-0">⟶</div>
          
          <div className="bg-ocean-800 border border-accent-cyan/50 p-4 rounded-xl min-w-[140px] shadow-[0_0_15px_rgba(0,240,255,0.1)]">
            OpenCV CLAHE<br/>(L-Channel Enh)
          </div>
          
          <div className="text-accent-teal shrink-0">⟶</div>
          
          <div className="bg-gradient-to-br from-ocean-800 to-ocean-700 border border-accent-teal/50 p-4 rounded-xl min-w-[140px] shadow-[0_0_15px_rgba(32,201,151,0.1)]">
            ResNet-50 / FPN<br/>(Faster R-CNN)
          </div>

          <div className="text-status-healthy shrink-0">⟶</div>

          <div className="bg-ocean-800 border border-ocean-700 p-4 rounded-xl min-w-[140px]">
            Classification<br/>& Counting
          </div>
          
          <div className="text-slate-500 shrink-0">⟶</div>
          
          <div className="bg-ocean-800 border border-ocean-700 p-4 rounded-xl min-w-[140px]">
             Database<br/>(MongoDB)
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {['React', 'Tailwind CSS', 'Python / Flask', 'PyTorch', 'Faster R-CNN', 'MongoDB', 'OpenCV', 'Framer Motion'].map((tech) => (
          <div key={tech} className="bg-ocean-800/50 border border-ocean-700 p-4 rounded-xl text-center font-medium text-slate-300 hover:border-accent-cyan hover:text-accent-cyan transition-colors">
            {tech}
          </div>
        ))}
      </div>
    </motion.div>
  );
};

export default About;
