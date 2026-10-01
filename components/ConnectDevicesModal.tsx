'use client';

import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import {
  Smartphone,
  Copy,
  Check,
  X,
  Wifi,
  Database,
  Radio,
  ExternalLink,
  Laptop,
  Users,
  ShieldCheck,
  Info,
} from 'lucide-react';
import { useStage } from '@/lib/stageContext';

interface ConnectDevicesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ConnectDevicesModal: React.FC<ConnectDevicesModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { lanUrl, lanIp, activeSubscribers, isCloudSync } = useStage();
  const [copied, setCopied] = useState(false);
  const [tunnelCopied, setTunnelCopied] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Generate QR code on canvas whenever lanUrl changes or modal opens
  useEffect(() => {
    if (isOpen && canvasRef.current && lanUrl) {
      QRCode.toCanvas(
        canvasRef.current,
        lanUrl,
        {
          width: 200,
          margin: 1.5,
          color: {
            dark: '#0f172a',
            light: '#f8fafc',
          },
        },
        (error) => {
          if (error) console.error('Error generating QR code:', error);
        }
      );
    }
  }, [isOpen, lanUrl]);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(lanUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyTunnelCmd = () => {
    navigator.clipboard.writeText('npx localtunnel --port 3000');
    setTunnelCopied(true);
    setTimeout(() => setTunnelCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-2xl bg-[#0f1322] border border-[#26314f] rounded-2xl shadow-2xl overflow-hidden text-slate-100 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1f2842] bg-[#141a2e]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Wifi className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-wide flex items-center gap-2">
                Connect Stage Devices
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live Sync
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Sync iPads, tablets, mobile phones, and stage monitors with zero latency
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Main Connection Box */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center bg-[#13192c] p-5 rounded-xl border border-[#232c48]">
            {/* QR Code */}
            <div className="flex flex-col items-center justify-center text-center">
              <div className="p-3 bg-white rounded-xl shadow-lg border border-slate-300">
                <canvas ref={canvasRef} className="rounded-lg w-[180px] h-[180px]" />
              </div>
              <p className="mt-2 text-xs font-medium text-slate-400 flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5 text-amber-400" />
                Scan with phone or tablet camera
              </p>
            </div>

            {/* Direct URL & IP Info */}
            <div className="space-y-4">
              <div>
                <label className="text-[11px] font-mono uppercase text-slate-400 tracking-wider block mb-1.5">
                  Local Network Address (Wi-Fi / LAN)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={lanUrl}
                    className="w-full bg-[#0a0d17] border border-[#2a3556] rounded-lg px-3 py-2 text-sm font-mono text-amber-300 select-all focus:outline-none"
                  />
                  <button
                    onClick={handleCopy}
                    className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                      copied
                        ? 'bg-emerald-600 text-white'
                        : 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold'
                    }`}
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <p className="mt-1.5 text-[11px] text-slate-400">
                  Ensure devices are connected to the same Wi-Fi network.
                </p>
              </div>

              {/* Status Counters */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-[#0b0e1a] p-2.5 rounded-lg border border-[#1e263d]">
                  <div className="text-slate-400 text-[10px] uppercase font-mono flex items-center gap-1">
                    <Radio className="w-3 h-3 text-emerald-400" /> Connected Devices
                  </div>
                  <div className="text-lg font-bold font-mono text-emerald-300 mt-0.5">
                    {activeSubscribers} {activeSubscribers === 1 ? 'device' : 'devices'}
                  </div>
                </div>

                <div className="bg-[#0b0e1a] p-2.5 rounded-lg border border-[#1e263d]">
                  <div className="text-slate-400 text-[10px] uppercase font-mono flex items-center gap-1">
                    <Database className="w-3 h-3 text-cyan-400" /> Database Mode
                  </div>
                  <div className="text-xs font-semibold font-mono text-cyan-300 mt-1 truncate">
                    {isCloudSync ? 'Supabase PostgreSQL (Cloud)' : 'Local File Storage'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Role Access Guide */}
          <div>
            <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-400" />
              Device Roles on Stage
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Musicians / Players */}
              <div className="bg-[#12172a] border border-[#202944] p-3.5 rounded-xl space-y-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                    <Smartphone className="w-4 h-4" />
                  </div>
                  <h4 className="text-sm font-bold text-white">Musicians (Stage)</h4>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Open link on tablets or phones. No password needed! Select their instrument to receive glowing intro cues.
                </p>
                <div className="text-[10px] font-mono text-emerald-400 bg-emerald-950/40 px-2 py-1 rounded border border-emerald-900/50">
                  Passkey: None (Public)
                </div>
              </div>

              {/* Controller */}
              <div className="bg-[#12172a] border border-[#202944] p-3.5 rounded-xl space-y-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400">
                    <Radio className="w-4 h-4" />
                  </div>
                  <h4 className="text-sm font-bold text-white">Stage Controller</h4>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Controls NEXT song, PREV song, and loop increments live during the ceremony for the active Bahagian.
                </p>
                <div className="text-[10px] font-mono text-blue-400 bg-blue-950/40 px-2 py-1 rounded border border-blue-900/50">
                  Passkey: <span className="font-bold">ctrl1</span> (or ctrl2)
                </div>
              </div>

              {/* Maestro */}
              <div className="bg-[#12172a] border border-[#202944] p-3.5 rounded-xl space-y-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
                    <Laptop className="w-4 h-4" />
                  </div>
                  <h4 className="text-sm font-bold text-white">Maestro / Admin</h4>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Reorder song queues, apply special intro/loop overrides per ceremony, and manage instrument cues.
                </p>
                <div className="text-[10px] font-mono text-amber-400 bg-amber-950/40 px-2 py-1 rounded border border-amber-900/50">
                  Passkey: <span className="font-bold">pagi123</span> / <span className="font-bold">admin999</span>
                </div>
              </div>
            </div>
          </div>

          {/* Database Persistence Guarantee Callout */}
          <div className="flex items-start gap-3 bg-cyan-950/20 border border-cyan-500/30 p-3.5 rounded-xl text-xs text-cyan-200">
            <Database className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-bold text-cyan-300">
                {isCloudSync ? 'Supabase Cloud PostgreSQL Active' : 'Shared Persistent Server Database Active'}
              </div>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                {isCloudSync
                  ? 'All changes (adding songs, setlist ordering, loop advancements, overrides) are saved directly to your Supabase PostgreSQL cloud database and broadcast in real time via WebSockets to every connected musician, controller, and maestro device globally.'
                  : 'All changes made on any connected device are saved to the server database (data/gamelan_db.json) and broadcasted in real time to every other screen.'}
              </p>
            </div>
          </div>

          {/* Optional Internet Tunneling (For outside Wi-Fi access) */}
          <div className="border-t border-[#1f2842] pt-4">
            <details className="group cursor-pointer">
              <summary className="text-xs font-mono uppercase tracking-wider text-slate-400 flex items-center justify-between select-none">
                <span className="flex items-center gap-1.5">
                  <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                  Need access from outside your Wi-Fi (over 4G / 5G)?
                </span>
                <span className="text-[10px] text-amber-400 group-open:rotate-180 transition-transform">
                  ▼
                </span>
              </summary>
              <div className="mt-3 bg-[#0a0d18] border border-[#1f2842] p-3 rounded-lg text-xs space-y-2">
                <p className="text-slate-400 text-[11px]">
                  To create a temporary public internet URL without port forwarding, run this command in a terminal:
                </p>
                <div className="flex items-center justify-between bg-black/60 px-3 py-2 rounded font-mono text-[11px] text-amber-300 border border-slate-800">
                  <span>npx localtunnel --port 3000</span>
                  <button
                    onClick={handleCopyTunnelCmd}
                    className="text-xs text-slate-400 hover:text-white px-2 py-0.5 rounded bg-slate-800/80 transition-colors"
                  >
                    {tunnelCopied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <p className="text-[10px] text-slate-500">
                  This generates a secure <code className="text-slate-400">https://*.loca.lt</code> link that works anywhere in the world!
                </p>
              </div>
            </details>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-[#1f2842] bg-[#141a2e] text-xs">
          <div className="text-slate-400 font-mono text-[11px] flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            Server Host IP: <span className="text-slate-200">{lanIp}</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#252f4d] hover:bg-[#313e65] text-white font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
