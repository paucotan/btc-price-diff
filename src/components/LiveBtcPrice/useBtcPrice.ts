import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';

interface TickerItem {
  id: string;
  label: string;
  currentPrice: number | null;
  priceChange24h: number | null;
  currencySymbol: string;
}

interface CachedData {
  items: TickerItem[];
  lastUpdated: number;
}

const CACHE_KEY = 'btc_ticker_data';
const RATE_LIMIT_KEY = 'coingecko_rate_limit';
const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes (matches refresh interval)
const REFRESH_INTERVAL = 2 * 60 * 1000; // 2 minutes (reduced from 1 minute)
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute window for rate limiting
const MAX_RETRIES = 2; // Reduced from 3 to be more conservative
const BASE_BACKOFF = 2000; // Start with 2 second backoff

// Enhanced fetch with rate limiting and better retry logic
const fetchWithRetry = async (
  url: string, 
  options: Record<string, unknown>,
  retries = MAX_RETRIES,
  backoff = BASE_BACKOFF
): Promise<any> => {
  // Check rate limits before making a request
  const now = Date.now();
  const rateLimitData = localStorage.getItem(RATE_LIMIT_KEY);
  
  if (rateLimitData) {
    const { timestamp, count } = JSON.parse(rateLimitData);
    // Reset count if we're in a new rate limit window
    if (now - timestamp > RATE_LIMIT_WINDOW) {
      localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify({ timestamp: now, count: 1 }));
    } else if (count >= 10) { // Conservative limit (10 calls per minute)
      // If we've hit the rate limit, wait until the next window
      const timeToWait = (timestamp + RATE_LIMIT_WINDOW) - now;
      console.log(`Rate limit reached. Waiting ${Math.ceil(timeToWait/1000)} seconds...`);
      await new Promise(resolve => setTimeout(resolve, timeToWait));
      // Reset the counter after waiting
      localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify({ timestamp: Date.now(), count: 1 }));
    } else {
      // Increment the counter
      localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify({ timestamp, count: count + 1 }));
    }
  } else {
    // Initialize rate limit tracking
    localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify({ timestamp: now, count: 1 }));
  }

  try {
    const response = await axios.get(url, { 
      ...options, 
      timeout: 10000, // Increased timeout
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip,deflate,compress',
      }
    });
    
    // If we get a 429 (Too Many Requests), handle it
    if (response.status === 429) {
      const retryAfter = parseInt(response.headers['retry-after'] || '5', 10) * 1000;
      console.log(`Rate limited. Retrying after ${retryAfter}ms...`);
      await new Promise(resolve => setTimeout(resolve, retryAfter));
      return fetchWithRetry(url, options, retries, backoff * 2);
    }
    
    return response;
  } catch (error: any) {
    if (retries > 0) {
      // Use exponential backoff with jitter
      const jitter = Math.random() * 1000;
      const delay = backoff + jitter;
      console.log(`Attempt ${MAX_RETRIES - retries + 1} failed. Retrying in ${Math.round(delay/1000)}s...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return fetchWithRetry(url, options, retries - 1, Math.min(backoff * 2, 30000)); // Cap at 30s
    }
    console.error('Max retries reached:', error.message);
    throw error;
  }
};

const useBtcPrice = () => {
  const [tickerItems, setTickerItems] = useState<TickerItem[]>([
    { id: 'btc-usd', label: 'BTC/USD', currentPrice: null, priceChange24h: null, currencySymbol: '$' },
    { id: 'btc-eur', label: 'BTC/EUR', currentPrice: null, priceChange24h: null, currencySymbol: '€' },
    { id: 'btc-eth', label: 'BTC/ETH', currentPrice: null, priceChange24h: null, currencySymbol: 'Ξ' },
    { id: 'btc-gold', label: 'Gold (oz)', currentPrice: null, priceChange24h: null, currencySymbol: 'oz' },
  ]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const isMounted = useRef(true);

  const getCachedData = (): CachedData | null => {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    
    try {
      const parsed = JSON.parse(cached);
      if (Date.now() - parsed.lastUpdated < CACHE_DURATION) {
        return parsed;
      }
    } catch (e) {
      console.error('Error parsing cached data:', e);
    }
    return null;
  };

  const saveToCache = useCallback((items: TickerItem[]) => {
    try {
      const dataToCache = {
        items,
        lastUpdated: Date.now(),
      };
      localStorage.setItem(CACHE_KEY, JSON.stringify(dataToCache));
    } catch (e) {
      console.error('Error saving to cache:', e);
    }
  }, []);

  const updateTickerItems = useCallback((newItems: TickerItem[]) => {
    setTickerItems(prevItems => 
      prevItems.map(item => {
        const updatedItem = newItems.find(newItem => newItem.id === item.id);
        return updatedItem ? { ...item, ...updatedItem } : item;
      })
    );
  }, []);

  const fetchBtcPrice = useCallback(async () => {
    if (!isMounted.current) return;
    
    // Don't make a new request if we're already loading
    if (isLoading) return;
    
    try {
      const cachedData = getCachedData();
      if (cachedData) {
        updateTickerItems(cachedData.items);
        setLastUpdated(cachedData.lastUpdated);
        setIsLoading(false);
        if (Date.now() - cachedData.lastUpdated < 60000) {
          return;
        }
      }
      
      setIsLoading(true);
      setError(null);
      
      const response = await fetchWithRetry(
        'https://api.coingecko.com/api/v3/coins/markets',
        {
          params: {
            vs_currency: 'usd',
            ids: 'bitcoin,ethereum,pax-gold',
            price_change_percentage: '24h',
          },
        }
      );
      
      const data = response.data.reduce((acc: any, coin: any) => {
        acc[coin.id] = coin;
        return acc;
      }, {});
      
      const btcData = data.bitcoin;
      const ethData = data.ethereum;
      const goldData = data['pax-gold'];
      
      if (!btcData || !ethData || !goldData) {
        throw new Error('Incomplete data received from API');
      }
      
      const btcEthPrice = btcData.current_price / ethData.current_price;
      const btcEthChange24h = ((btcData.price_change_percentage_24h - ethData.price_change_percentage_24h) / 
        (1 + ethData.price_change_percentage_24h / 100)) || 0;
      
      // Gold price per ounce in USD
      const goldPricePerOz = goldData.current_price * 31.1;
      
      const updatedItems: TickerItem[] = [
        { 
          id: 'btc-usd', 
          label: 'BTC/USD', 
          currentPrice: btcData.current_price, 
          priceChange24h: btcData.price_change_percentage_24h, 
          currencySymbol: '$' 
        },
        { 
          id: 'btc-eur', 
          label: 'BTC/EUR', 
          currentPrice: btcData.current_price * 0.9,
          priceChange24h: btcData.price_change_percentage_24h, 
          currencySymbol: '€' 
        },
        { 
          id: 'btc-eth', 
          label: 'BTC/ETH', 
          currentPrice: btcEthPrice, 
          priceChange24h: btcEthChange24h, 
          currencySymbol: 'Ξ' 
        },
        { 
          id: 'gold-usd', 
          label: 'Gold (oz)/USD', 
          currentPrice: goldPricePerOz, 
          priceChange24h: goldData.price_change_percentage_24h, 
          currencySymbol: '$' 
        },
      ];
      
      updateTickerItems(updatedItems);
      setLastUpdated(Date.now());
      saveToCache(updatedItems);
      
    } catch (err) {
      console.error('Error fetching price data:', err);
      setError('Failed to fetch live data. Using cached data if available.');
      const cachedData = getCachedData();
      if (cachedData) {
        updateTickerItems(cachedData.items);
        setLastUpdated(cachedData.lastUpdated);
      }
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  }, [saveToCache, updateTickerItems]);

  useEffect(() => {
    isMounted.current = true;
    fetchBtcPrice();
    
    const intervalId = setInterval(fetchBtcPrice, REFRESH_INTERVAL);
    
    return () => {
      isMounted.current = false;
      clearInterval(intervalId);
    };
  }, [fetchBtcPrice]);

  return {
    items: tickerItems,
    isLoading,
    error,
    lastUpdated,
    refresh: fetchBtcPrice,
  };
};

export default useBtcPrice;
