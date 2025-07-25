import React, { useRef, useEffect } from 'react';
import { ArrowUp, ArrowDown, RefreshCw } from 'lucide-react';
import useBtcPrice from './useBtcPrice';

const LiveBtcPrice: React.FC = () => {
  const { items, isLoading, error, lastUpdated, refresh } = useBtcPrice();
  const tickerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<Animation | null>(null);
  const isHovered = useRef(false);

  const handleMouseEnter = () => {
    isHovered.current = true;
    if (animationRef.current) {
      animationRef.current.pause();
    }
  };

  const handleMouseLeave = () => {
    isHovered.current = false;
    if (animationRef.current) {
      animationRef.current.play();
    }
  };

  // Format price with appropriate decimal places
  const formatPrice = (price: number | null, symbol: string): string => {
    if (price === null) return 'Loading...';
    
    if (symbol === 'oz') {
      return `${price.toFixed(4)}`;
    } else if (symbol === 'Ξ') {
      return `${symbol}${price.toFixed(6)}`;
    }
    return `${symbol}${price.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
  };

  // Format percentage change
  const formatChange = (change: number | null): string => {
    if (change === null) return '';
    const prefix = change >= 0 ? '+' : '';
    return `${prefix}${change.toFixed(2)}%`;
  };

  // Set up ticker animation
  useEffect(() => {
    const ticker = tickerRef.current;
    const content = contentRef.current;
    
    if (!ticker || !content) return;
    
    const contentWidth = content.scrollWidth;
    const viewportWidth = ticker.clientWidth;
    
    if (contentWidth <= viewportWidth) {
      if (animationRef.current) {
        animationRef.current.cancel();
        animationRef.current = null;
      }
      return;
    }
    
    const duration = Math.max(contentWidth / 50, 20);
    
    const keyframes = [
      { transform: 'translateX(0)' },
      { transform: `translateX(-${contentWidth - viewportWidth}px)` }
    ];
    
    const options: KeyframeAnimationOptions = {
      duration: duration * 1000,
      iterations: Infinity,
      easing: 'linear'
    };
    
    animationRef.current = content.animate(keyframes, options);
    
    const handleMouseEnter = () => {
      if (animationRef.current) {
        animationRef.current.pause();
      }
    };
    
    const handleMouseLeave = () => {
      if (animationRef.current) {
        animationRef.current.play();
      }
    };
    
    ticker.addEventListener('mouseenter', handleMouseEnter);
    ticker.addEventListener('mouseleave', handleMouseLeave);
    
    return () => {
      if (animationRef.current) {
        animationRef.current.cancel();
      }
      ticker.removeEventListener('mouseenter', handleMouseEnter);
      ticker.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [items]);

  // Format last updated time
  const formatLastUpdated = (timestamp: number | null): string => {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleTimeString();
  };

  return (
    <div className="bg-gray-900 text-white py-3 px-4 shadow-md w-full">
      <div className="container mx-auto flex flex-col md:flex-row items-center justify-between">
        <div className="flex items-center mb-2 md:mb-0">
          <h2 className="text-sm font-semibold mr-2">Live Prices:</h2>
          <button
            onClick={refresh}
            disabled={isLoading}
            className="text-gray-300 hover:text-white transition-colors"
            aria-label="Refresh prices"
            type="button"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          {lastUpdated && (
            <span className="text-xs text-gray-400 ml-2">
              Updated: {formatLastUpdated(lastUpdated)}
            </span>
          )}
        </div>
        
        <div 
          ref={tickerRef}
          className="ticker-container"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <div ref={contentRef} className="ticker-content">
            {items.map((item) => (
              <div key={item.id} className="ticker-item">
                <span className="text-sm font-medium text-gray-300">{item.label}</span>
                <span className="text-sm font-mono font-medium text-white">
                  {formatPrice(item.currentPrice, item.currencySymbol)}
                </span>
                {item.priceChange24h !== null && (
                  <span 
                    className={`inline-flex items-center text-xs px-1.5 py-0.5 rounded font-medium ${item.priceChange24h >= 0 ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}
                  >
                    {item.priceChange24h >= 0 ? (
                      <ArrowUp className="w-3 h-3 mr-0.5" />
                    ) : (
                      <ArrowDown className="w-3 h-3 mr-0.5" />
                    )}
                    {formatChange(item.priceChange24h)}
                  </span>
                )}
              </div>
            ))}
            {/* Duplicate items for seamless looping */}
            {items.map((item) => (
              <div key={`${item.id}-dupe`} className="ticker-item">
                <span className="text-sm font-medium text-gray-300">{item.label}</span>
                <span className="text-sm font-mono font-medium text-white">
                  {formatPrice(item.currentPrice, item.currencySymbol)}
                </span>
                {item.priceChange24h !== null && (
                  <span 
                    className={`inline-flex items-center text-xs px-1.5 py-0.5 rounded font-medium ${item.priceChange24h >= 0 ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}
                  >
                    {item.priceChange24h >= 0 ? (
                      <ArrowUp className="w-3 h-3 mr-0.5" />
                    ) : (
                      <ArrowDown className="w-3 h-3 mr-0.5" />
                    )}
                    {formatChange(item.priceChange24h)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {error && (
        <div className="text-center text-sm text-yellow-400 mt-1">
          {error}
        </div>
      )}
    </div>
  );
};

export default LiveBtcPrice;
