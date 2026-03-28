import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Palette, Layout, Settings as SettingsIcon } from 'lucide-react';

export default function Settings({ settings, setSettings }: { settings: any, setSettings: any }) {
  const [activeTab, setActiveTab] = useState('Colors');

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSettings({ ...settings, logo: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  const themeGradients = [
    'bg-gradient-to-r from-red-500 to-rose-600',
    'bg-gradient-to-r from-blue-500 to-indigo-600',
    'bg-gradient-to-r from-emerald-400 to-teal-500',
    'bg-gradient-to-r from-purple-500 to-fuchsia-600',
    'bg-gradient-to-r from-orange-400 to-amber-500',
    'bg-gradient-to-r from-pink-500 to-rose-500'
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold">Invoice Settings</h2>
      
      <div className="flex bg-neutral-100 p-1 rounded-2xl">
        {['Templates', 'Colors', 'Options'].map(tab => (
          <button 
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 rounded-xl font-medium transition-all ${activeTab === tab ? 'bg-white shadow-sm' : 'text-neutral-500 hover:bg-neutral-200/50'}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'Templates' && (
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-neutral-100">
          <h3 className="font-bold mb-4">Choose Template</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              { id: 'modern', name: 'Modern', desc: 'Vibrant & bold with dark headers' },
              { id: 'classic', name: 'Classic', desc: 'Traditional serif, professional' },
              { id: 'minimal', name: 'Minimal', desc: 'Clean, spacious, grayscale' },
              { id: 'orange', name: 'Orange', desc: 'Orange accents, simple table' },
              { id: 'blue', name: 'Blue', desc: 'Blue header/footer, gray rows' }
            ].map(tpl => (
              <button
                key={tpl.id}
                onClick={() => setSettings({ ...settings, template: tpl.id })}
                className={`p-4 rounded-2xl border-2 text-left transition-all ${settings.template === tpl.id ? 'border-blue-500 bg-blue-50/50' : 'border-neutral-100 hover:border-neutral-200'}`}
              >
                <div className={`w-full h-32 rounded-xl mb-4 bg-neutral-100 border border-neutral-200 overflow-hidden flex flex-col`}>
                  {tpl.id === 'modern' && (
                    <>
                      <div className="h-8 bg-neutral-800 w-full"></div>
                      <div className="flex-1 p-2 space-y-1">
                        <div className="w-1/2 h-2 bg-neutral-200 rounded"></div>
                        <div className="w-1/3 h-2 bg-neutral-200 rounded"></div>
                      </div>
                    </>
                  )}
                  {tpl.id === 'classic' && (
                    <div className="flex-1 p-2 flex flex-col">
                      <div className="flex justify-between border-b border-neutral-300 pb-1 mb-1">
                        <div className="w-1/3 h-3 bg-neutral-300 rounded"></div>
                        <div className="w-1/4 h-2 bg-neutral-200 rounded"></div>
                      </div>
                      <div className="space-y-1 mt-1">
                        <div className="w-full h-1 bg-neutral-200"></div>
                        <div className="w-full h-1 bg-neutral-200"></div>
                      </div>
                    </div>
                  )}
                  {tpl.id === 'minimal' && (
                    <div className="flex-1 p-2 flex flex-col justify-between">
                      <div className="flex justify-between">
                        <div className="w-1/4 h-2 bg-neutral-200 rounded"></div>
                        <div className="w-1/3 h-4 bg-neutral-200 rounded"></div>
                      </div>
                      <div className="w-1/3 h-3 bg-neutral-300 rounded self-end"></div>
                    </div>
                  )}
                </div>
                <h4 className="font-bold text-neutral-800 capitalize">{tpl.name}</h4>
                <p className="text-xs text-neutral-500 mt-1">{tpl.desc}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'Colors' && (
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-neutral-100">
          <h3 className="font-bold mb-4">Choose Theme</h3>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
            {themeGradients.map(gradient => (
              <button 
                key={gradient} 
                onClick={() => setSettings({ ...settings, themeColor: gradient })}
                className={`w-12 h-12 rounded-full ${gradient} shadow-md transition-transform hover:scale-110 ${settings.themeColor === gradient ? 'ring-4 ring-offset-2 ring-neutral-400 scale-110' : ''}`}
              />
            ))}
          </div>
          <div className="mt-6">
            <label className="block font-medium mb-2">Upload Logo</label>
            <input type="file" onChange={handleLogoUpload} className="block w-full text-sm text-neutral-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 transition-colors cursor-pointer"/>
          </div>
        </div>
      )}

      {activeTab === 'Options' && (
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-neutral-100 space-y-4">
          <div className="flex justify-between items-center p-2 hover:bg-neutral-50 rounded-xl transition-colors cursor-pointer" onClick={() => setSettings({...settings, showQtyPrice: !settings.showQtyPrice})}>
            <span className="font-medium text-neutral-700">Show quantity and unit price</span>
            <input type="checkbox" checked={settings.showQtyPrice} readOnly className="w-5 h-5 rounded border-neutral-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
          </div>
          <div className="flex justify-between items-center p-2 hover:bg-neutral-50 rounded-xl transition-colors cursor-pointer" onClick={() => setSettings({...settings, showDiscount: !settings.showDiscount})}>
            <span className="font-medium text-neutral-700">Show discount</span>
            <input type="checkbox" checked={settings.showDiscount} readOnly className="w-5 h-5 rounded border-neutral-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
          </div>
          <div className="flex flex-col p-2 hover:bg-neutral-50 rounded-xl transition-colors">
            <span className="font-medium text-neutral-700 mb-2">Currency</span>
            <select 
              value={settings.currency || 'GHC'} 
              onChange={(e) => setSettings({...settings, currency: e.target.value})}
              className="w-full p-3 rounded-xl border border-neutral-200 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="GHC">GHC - Ghanaian Cedi</option>
              <option value="USD">USD - US Dollar</option>
              <option value="EUR">EUR - Euro</option>
              <option value="GBP">GBP - British Pound</option>
              <option value="NGN">NGN - Nigerian Naira</option>
              <option value="KES">KES - Kenyan Shilling</option>
              <option value="ZAR">ZAR - South African Rand</option>
            </select>
          </div>
        </div>
      )}
    </motion.div>
  );
}
