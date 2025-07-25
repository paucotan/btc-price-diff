import React, { useState } from 'react';
import { Calculator, TrendingUp } from 'lucide-react';

type Currency = 'USD' | 'EUR';

interface CalculatorState {
  price1: string;
  price2: string;
  investmentAmount: string;
  currency: Currency;
}

export default function BitcoinPriceCalculator() {
  const [price1, setPrice1] = useState('');
  const [price2, setPrice2] = useState('');
  const [investmentAmount, setInvestmentAmount] = useState('1000');
  const [currency, setCurrency] = useState<Currency>('USD');
  
  // Exchange rate (EUR to USD) - in a real app, this would be fetched from an API
  const eurToUsd = 1.09;
  const usdToEur = 1 / eurToUsd;

  const convertCurrency = (amount: number, fromCurrency: Currency, toCurrency: Currency): number => {
    if (fromCurrency === toCurrency) return amount;
    if (fromCurrency === 'USD' && toCurrency === 'EUR') {
      return amount * usdToEur;
    }
    if (fromCurrency === 'EUR' && toCurrency === 'USD') {
      return amount * eurToUsd;
    }
    return amount;
  };

  const calculations = () => {
    const p1 = parseFloat(price1);
    const p2 = parseFloat(price2);
    const investment = parseFloat(investmentAmount);

    if (!p1 || !p2 || !investment) return null;

    // Get prices in selected currency
    const p1Sel = currency === 'USD' ? p1 : convertCurrency(p1, 'EUR', 'USD');
    const p2Sel = currency === 'USD' ? p2 : convertCurrency(p2, 'EUR', 'USD');

    // Calculate Bitcoin amounts (using selected currency prices)
    const btc1 = investment / p1Sel;
    const btc2 = investment / p2Sel;

    // Calculate investment value difference
    const investmentValue1 = btc1 * p2Sel;
    const investmentValue2 = btc2 * p2Sel;
    const investmentDiff = investmentValue1 - investmentValue2;

    // Calculate differences
    const priceDiff = Math.abs(p1Sel - p2Sel);
    const percentDiff = ((Math.abs(p1Sel - p2Sel) / Math.min(p1Sel, p2Sel)) * 100);

    return {
      p1Sel, p2Sel,
      btc1, btc2,
      investmentDiff,
      priceDiff, percentDiff,
      betterDeal: investmentDiff > 0 ? 1 : 2
    };
  };

  const calc = calculations();

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800 p-4">
      <div className="max-w-6xl mx-auto pt-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Calculator className="w-6 h-6 text-white/90" />
            <h1 className="text-2xl font-bold text-white">Bitcoin Price Calculator</h1>
          </div>
        </div>

        {/* Main Glass Container */}
        <div className="backdrop-blur-xl bg-white/10 rounded-3xl shadow-2xl border border-white/20 p-6 mb-6">
          {/* Input Section */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {/* Price 1 */}
            <div>
              <label className="block text-xs font-medium text-white/80 mb-2">Bitcoin Price 1</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/60 font-medium">
                  {currency === 'USD' ? '$' : '€'}
                </span>
                <input
                  type="number"
                  value={price1}
                  onChange={(e) => setPrice1(e.target.value)}
                  placeholder="98500"
                  className="w-full pl-8 pr-3 py-3 backdrop-blur-lg bg-white/10 border border-white/20 rounded-xl focus:border-white/40 focus:outline-none text-white placeholder-white/40 text-sm"
                />
              </div>
            </div>

            {/* Price 2 */}
            <div>
              <label className="block text-xs font-medium text-white/80 mb-2">Bitcoin Price 2</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/60 font-medium">
                  {currency === 'USD' ? '$' : '€'}
                </span>
                <input
                  type="number"
                  value={price2}
                  onChange={(e) => setPrice2(e.target.value)}
                  placeholder="97000"
                  className="w-full pl-8 pr-3 py-3 backdrop-blur-lg bg-white/10 border border-white/20 rounded-xl focus:border-white/40 focus:outline-none text-white placeholder-white/40 text-sm"
                />
              </div>
            </div>

            {/* Investment Amount */}
            <div>
              <label className="block text-xs font-medium text-white/80 mb-2">Investment Amount</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/60 font-medium">
                  {currency === 'USD' ? '$' : '€'}
                </span>
                <input
                  type="number"
                  value={investmentAmount}
                  onChange={(e) => setInvestmentAmount(e.target.value)}
                  className="w-full pl-8 pr-3 py-3 backdrop-blur-lg bg-white/10 border border-white/20 rounded-xl focus:border-white/40 focus:outline-none text-white text-sm"
                />
              </div>
            </div>

            {/* Currency Toggle */}
            <div>
              <label className="block text-xs font-medium text-white/80 mb-2">Currency</label>
              <div className="flex gap-1 backdrop-blur-lg bg-white/10 rounded-xl p-1 border border-white/20">
                <button
                  onClick={() => setCurrency('USD')}
                  className={`flex-1 py-2 px-3 rounded-lg font-medium text-sm transition-all ${
                    currency === 'USD' 
                      ? 'bg-white/20 text-white shadow-lg' 
                      : 'text-white/70 hover:text-white'
                  }`}
                >
                  USD
                </button>
                <button
                  onClick={() => setCurrency('EUR')}
                  className={`flex-1 py-2 px-3 rounded-lg font-medium text-sm transition-all ${
                    currency === 'EUR' 
                      ? 'bg-white/20 text-white shadow-lg' 
                      : 'text-white/70 hover:text-white'
                  }`}
                >
                  EUR
                </button>
              </div>
            </div>
          </div>

          {/* Results Section */}
          {calc && (
            <div className="space-y-4">
              {/* Comparison Cards */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className={`backdrop-blur-lg rounded-2xl p-4 border transition-all ${
                  calc.betterDeal === 1 
                    ? 'bg-emerald-500/20 border-emerald-400/40 shadow-lg shadow-emerald-500/20' 
                    : 'bg-white/5 border-white/10'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white/90 font-semibold text-sm">Price 1</span>
                    {calc.betterDeal === 1 && (
                      <div className="flex items-center gap-1 text-emerald-300 text-xs">
                        <TrendingUp className="w-3 h-3" />
                        <span>Better</span>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="flex flex-col gap-1">
                      {calc.betterDeal === 2 && (
                        <p className="text-emerald-400 text-sm font-medium">
                          {currency === 'USD' ? '$' : '€'}
                          {Math.abs(calc.investmentDiff).toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0})}
                          {' more value'}
                        </p>
                      )}
                      <p className="text-white text-lg font-bold">
                        {calc.btc1.toFixed(6)} BTC
                      </p>
                    </div>
                  </div>
                </div>

                <div className={`backdrop-blur-lg rounded-2xl p-4 border transition-all ${
                  calc.betterDeal === 2 
                    ? 'bg-emerald-500/20 border-emerald-400/40 shadow-lg shadow-emerald-500/20' 
                    : 'bg-white/5 border-white/10'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white/90 font-semibold text-sm">Price 2</span>
                    {calc.betterDeal === 2 && (
                      <div className="flex items-center gap-1 text-emerald-300 text-xs">
                        <TrendingUp className="w-3 h-3" />
                        <span>Better</span>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="flex flex-col gap-1">
                      {calc.betterDeal === 1 && (
                        <p className="text-red-400 text-sm font-medium">
                          {currency === 'USD' ? '$' : '€'}
                          {Math.abs(calc.investmentDiff).toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0})}
                          {' less value'}
                        </p>
                      )}
                      <p className="text-white text-lg font-bold">
                        {calc.btc2.toFixed(6)} BTC
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Key Metrics Row */}
              <div className="grid grid-cols-3 gap-4">
                <div className="backdrop-blur-lg bg-white/5 rounded-xl p-3 border border-white/10 text-center">
                  <p className="text-white/60 text-xs mb-1">Investment Value Difference</p>
                  <p className="text-white font-bold text-sm">
                    {currency === 'USD' ? '$' : '€'}
                    {Math.abs(calc.investmentDiff).toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0})}
                  </p>
                </div>
                <div className="backdrop-blur-lg bg-emerald-500/20 rounded-xl p-3 border border-emerald-400/30 text-center">
                  <p className="text-emerald-200 text-xs mb-1">Better Choice</p>
                  <p className="text-emerald-100 font-bold text-sm">
                    Price {calc.betterDeal}
                  </p>
                </div>
                <div className="text-emerald-200/70 text-xs">Choose this</div>
              </div>
            </div>
          )}

          {!calc && (
            <div className="text-center py-8">
              <Calculator className="w-12 h-12 text-white/30 mx-auto mb-3" />
              <p className="text-white/60 text-sm">Enter prices to see comparison</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}