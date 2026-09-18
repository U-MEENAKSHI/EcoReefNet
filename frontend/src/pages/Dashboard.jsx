import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Calendar, MapPin, Activity, Download, RefreshCcw } from 'lucide-react';
import axios from 'axios';

const API_BASE = '/api';

const Dashboard = () => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All time');

  useEffect(() => {
    fetchRecords();
  }, []);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE}/records`);
      setRecords(response.data.records || []);
    } catch (error) {
      console.error('Failed to fetch records:', error);
      // Fallback local mock data for demo if API fails
      setRecords([
        { _id: '1', imageId: 'IMG-001', timestamp: new Date(Date.now() - 86400000).toISOString(), counts: { healthy: 12, bleached: 4, dead: 1 }, riskLevel: 'Low Risk', riskScore: 0.17 },
        { _id: '2', imageId: 'IMG-002', timestamp: new Date(Date.now() - 186400000).toISOString(), counts: { healthy: 5, bleached: 20, dead: 8 }, riskLevel: 'Critical Risk', riskScore: 0.54 },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Compute Aggregates
  const totalCorals = records.reduce((acc, r) => acc + ((r.counts?.healthy || 0) + (r.counts?.bleached || 0) + (r.counts?.dead || 0)), 0);
  const totalHealthy = records.reduce((acc, r) => acc + (r.counts?.healthy || 0), 0);
  const totalBleached = records.reduce((acc, r) => acc + (r.counts?.bleached || 0), 0);
  const totalDead = records.reduce((acc, r) => acc + (r.counts?.dead || 0), 0);

  const pieData = [
    { name: 'Healthy', value: totalHealthy, color: '#059669' },
    { name: 'Bleached', value: totalBleached, color: '#f59e0b' },
    { name: 'Dead', value: totalDead, color: '#dc2626' },
  ];

  // Bar chart data grouping by something simple (e.g., individual images or days)
  const barData = records.slice(0, 10).map((r, i) => ({
    name: `Scan ${i+1}`,
    Healthy: r.counts?.healthy || 0,
    Bleached: r.counts?.bleached || 0,
    Dead: r.counts?.dead || 0
  }));

  const handleDownloadCSV = () => {
    let csv = 'ID,Date,Healthy,Bleached,Dead,Risk Level,Risk Score\n';
    records.forEach(r => {
      csv += `${r.imageId},${new Date(r.timestamp).toLocaleDateString()},${r.counts?.healthy || 0},${r.counts?.bleached || 0},${r.counts?.dead || 0},${r.riskLevel},${r.riskScore}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ecoreef-records.csv';
    a.click();
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="pt-24 pb-12 px-6 max-w-7xl mx-auto min-h-screen"
    >
      <div className="flex flex-col md:flex-row justify-between items-end mb-8 gap-4">
        <div>
          <h1 className="text-4xl font-bold mb-2">Analytics Dashboard</h1>
          <p className="text-slate-400">Holistic view of monitored reef health across the database cluster.</p>
        </div>
        
        <div className="flex gap-4">
          <select 
            className="bg-ocean-800 border border-ocean-700 rounded-lg px-4 py-2 outline-none focus:border-accent-cyan"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option>All time</option>
            <option>Last 7 days</option>
            <option>Last 30 days</option>
          </select>
          <button onClick={handleDownloadCSV} className="btn-secondary flex items-center gap-2 py-2">
            <Download className="w-4 h-4" /> CSV
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20 text-accent-cyan">
          <RefreshCcw className="w-10 h-10 animate-spin" />
        </div>
      ) : (
        <>
          {/* Top KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="glass-panel p-6 border-l-4 border-l-accent-cyan">
              <div className="text-slate-400 text-sm font-semibold mb-2">TOTAL CORALS LOGGED</div>
              <div className="text-3xl font-display font-bold text-white">{totalCorals.toLocaleString()}</div>
            </div>
            <div className="glass-panel p-6 border-l-4 border-l-status-healthy">
              <div className="text-slate-400 text-sm font-semibold mb-2">HEALTHY COUNT</div>
              <div className="text-3xl font-display font-bold text-status-healthy">{totalHealthy.toLocaleString()}</div>
            </div>
            <div className="glass-panel p-6 border-l-4 border-l-status-bleached">
              <div className="text-slate-400 text-sm font-semibold mb-2">BLEACHED COUNT</div>
              <div className="text-3xl font-display font-bold text-status-bleached">{totalBleached.toLocaleString()}</div>
            </div>
            <div className="glass-panel p-6 border-l-4 border-l-status-dead">
              <div className="text-slate-400 text-sm font-semibold mb-2">DEAD / RUBBLE COUNT</div>
              <div className="text-3xl font-display font-bold text-status-dead">{totalDead.toLocaleString()}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
            {/* Pie Chart */}
            <div className="glass-panel p-6">
              <h3 className="text-lg font-bold mb-6">Aggregate Category Distribution</h3>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0a1d33', border: '1px solid #122f4d', borderRadius: '8px' }}
                      itemStyle={{ color: '#e2e8f0' }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Bar Chart */}
            <div className="glass-panel p-6 lg:col-span-2">
              <h3 className="text-lg font-bold mb-6">Historical Health Trend</h3>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                    <XAxis dataKey="name" stroke="#64748b" />
                    <YAxis stroke="#64748b" />
                    <Tooltip cursor={{ fill: '#122f4d' }} contentStyle={{ backgroundColor: '#0a1d33', border: '1px solid #122f4d', borderRadius: '8px' }} />
                    <Legend />
                    <Bar dataKey="Healthy" stackId="a" fill="#059669" />
                    <Bar dataKey="Bleached" stackId="a" fill="#f59e0b" />
                    <Bar dataKey="Dead" stackId="a" fill="#dc2626" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Database Table */}
          <div className="glass-panel overflow-hidden">
            <div className="p-6 border-b border-ocean-700 flex justify-between items-center">
              <h3 className="text-lg font-bold">Recent Mongo DB Ingestions</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-ocean-900/50 text-slate-400 text-sm">
                    <th className="p-4 border-b border-ocean-700">Image ID</th>
                    <th className="p-4 border-b border-ocean-700">Date Logged</th>
                    <th className="p-4 border-b border-ocean-700">Healthy</th>
                    <th className="p-4 border-b border-ocean-700">Bleached</th>
                    <th className="p-4 border-b border-ocean-700">Dead</th>
                    <th className="p-4 border-b border-ocean-700">Risk Assessment</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r, i) => (
                    <tr key={i} className="hover:bg-ocean-800/50 transition-colors border-b border-ocean-700/50 last:border-0 text-sm">
                      <td className="p-4 font-mono text-accent-cyan">{r.imageId}</td>
                      <td className="p-4">{new Date(r.timestamp).toLocaleString()}</td>
                      <td className="p-4 text-emerald-400">{r.counts?.healthy ?? 0}</td>
                      <td className="p-4 text-amber-400">{r.counts?.bleached ?? 0}</td>
                      <td className="p-4 text-red-400">{r.counts?.dead ?? 0}</td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold
                          ${r.riskLevel === 'Low Risk' ? 'bg-emerald-900/50 text-emerald-400' : 
                            r.riskLevel === 'Moderate Risk' ? 'bg-amber-900/50 text-amber-400' : 
                            'bg-red-900/50 text-red-400'} border border-current`}
                        >
                          {r.riskLevel}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {records.length === 0 && (
                    <tr>
                      <td colSpan="6" className="p-8 text-center text-slate-500">No database records found. Upload an image to generate data.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </motion.div>
  );
};

export default Dashboard;
