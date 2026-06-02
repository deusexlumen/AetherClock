import React, { useEffect, useState } from 'react';

interface ClockProps {
  className?: string;
  isAlarmActive: boolean;
}

export const Clock: React.FC<ClockProps> = ({ className, isAlarmActive }) => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Ensure double digits for hours and minutes manually to avoid locale quirks
  const hours = time.getHours().toString().padStart(2, '0');
  const minutes = time.getMinutes().toString().padStart(2, '0');
  const seconds = time.getSeconds() % 2 === 0; // Blink separator

  return (
    <div className={`flex items-center justify-center bg-black/40 rounded-lg p-2 sm:p-4 border-2 border-white/5 shadow-inset-screen ${className}`}>
      <div className="font-digital font-black text-4xl sm:text-6xl md:text-8xl tracking-widest text-radio-lit led-text-shadow flex items-center">
        <span>{hours}</span>
        <span className={`mx-0.5 sm:mx-2 ${seconds ? 'opacity-100' : 'opacity-20 transition-opacity duration-200'}`}>:</span>
        <span>{minutes}</span>
      </div>
      
      {/* Indicators */}
      <div className="flex flex-col ml-2 sm:ml-6 gap-1 sm:gap-2 text-[6px] sm:text-[10px] font-mono text-radio-dim uppercase tracking-wider">
        <div className={`flex items-center gap-2 ${time.getHours() < 12 ? 'text-radio-lit led-text-shadow' : ''}`}>
          <div className="w-1 h-1 rounded-full bg-current"></div>
          AM
        </div>
        <div className={`flex items-center gap-2 ${time.getHours() >= 12 ? 'text-radio-lit led-text-shadow' : ''}`}>
          <div className="w-1 h-1 rounded-full bg-current"></div>
          PM
        </div>
        <div className={`flex items-center gap-2 mt-2 transition-all duration-300 ${isAlarmActive ? 'text-radio-lit led-text-shadow' : 'text-radio-dim'}`}>
            <div className={`w-1 h-1 rounded-full bg-current ${isAlarmActive ? 'animate-pulse' : ''}`}></div>
            ALARM
        </div>
      </div>
    </div>
  );
};