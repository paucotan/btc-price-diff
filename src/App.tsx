import React from 'react';
import BitcoinPriceCalculator from './bitcoin-price-calculator';
import LiveBtcTicker from './components/LiveBtcPrice';

function App() {
  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Ticker Bar - Reduced height */}
      <div className="h-[60px] bg-gray-900 text-white overflow-hidden flex items-center">
        <LiveBtcTicker />
      </div>
      
      {/* Full Screen Calculator */}
      <div className="flex-1">
        <BitcoinPriceCalculator />
      </div>
    </div>
  );
}

export default App;
