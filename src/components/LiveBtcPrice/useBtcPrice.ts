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
// Increased cache and refresh intervals to be more conservative with API calls
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute window for rate limiting
const MAX_RETRIES = 1; // Reduced to 1 to be more conservative
const BASE_BACKOFF = 3000; // Start with 3 second backoff

// Enhanced fetch with rate limiting, better retry logic, and improved error handling
const fetchWithRetry = async (
  url: string, 
  options: Record<string, unknown> = {},
  retries = MAX_RETRIES,
  backoff = BASE_BACKOFF
): Promise<any> => {
  // Check rate limits before making a request
  const now = Date.now();
  const rateLimitData = localStorage.getItem(RATE_LIMIT_KEY);
  
  try {
    // Handle rate limiting
    if (rateLimitData) {
      const { timestamp, count } = JSON.parse(rateLimitData);
      // Reset count if we're in a new rate limit window
      if (now - timestamp > RATE_LIMIT_WINDOW) {
        localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify({ timestamp: now, count: 1 }));
      } else if (count >= 5) { // Reduced limit to 5 calls per minute to be safe
        // If we've hit the rate limit, wait until the next window
        const timeToWait = (timestamp + RATE_LIMIT_WINDOW) - now;
        console.warn(`Rate limit reached. Waiting ${Math.ceil(timeToWait/1000)} seconds...`);
        await new Promise(resolve => setTimeout(resolve, timeToWait + 1000)); // Add 1s buffer
        // Reset the counter after waiting
        localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify({ timestamp: Date.now(), count: 1 }));
      } else {
        // Increment the counter
        localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify({ timestamp, count: count + 1 }));
      }
    } else {
      // Initialize rate limit counter
      localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify({ timestamp: now, count: 1 }));
    }
    
    // Add a small delay between requests to be extra safe
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Make the API request
    const response = await axios({
      ...options,
      url,
      method: 'GET',
      timeout: 15000, // Increased to 15 second timeout
      headers: {
        'Accept': 'application/json',
        'Cache-Control': 'no-cache',
        ...(options.headers as object || {})
      }
    });

    // Log successful API call for debugging
    console.log(`API call to ${url} successful`);
    return response;
  } catch (error: any) {
    console.error(`API call failed (${retries} retries left):`, error.message);
    
    // If we get rate limited, wait longer before retrying
    if (error.response?.status === 429) {
      console.warn('Rate limited by API, waiting before retry...');
      await new Promise(resolve => setTimeout(resolve, 30000)); // Wait 30 seconds
      // Reset rate limit counter
      localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify({ timestamp: Date.now(), count: 0 }));
    }
    
    if (retries <= 0) {
      console.error('Max retries reached, giving up');
      throw error;
    }
    
    // Exponential backoff with jitter
    const jitter = Math.floor(Math.random() * 1000); // Add up to 1s jitter
    const delay = backoff + jitter;
    console.log(`Retrying in ${delay}ms...`);
    
    await new Promise(resolve => setTimeout(resolve, delay));
    return fetchWithRetry(url, options, retries - 1, Math.min(backoff * 2, 30000)); // Cap max backoff at 30s
  }
};

const useBtcPrice = () => {
  const [tickerItems, setTickerItems] = useState<TickerItem[]>([
    { id: 'btc-usd', label: 'BTC/USD', currentPrice: null, priceChange24h: null, currencySymbol: '$' },
    { id: 'btc-eur', label: 'BTC/EUR', currentPrice: null, priceChange24h: null, currencySymbol: '€' },
    { id: 'btc-eth', label: 'BTC/ETH', currentPrice: null, priceChange24h: null, currencySymbol: 'Ξ' },
    { id: 'gold-usd', label: 'Gold (oz)/USD', currentPrice: null, priceChange24h: null, currencySymbol: '$' },
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
    if (isLoading) {
      console.log('Skipping fetch - already loading');
      return;
    }
    
    try {
      const cachedData = getCachedData();
      const now = Date.now();
      
      // Always use cached data if available, even if we're going to refresh
      if (cachedData) {
        console.log('Using cached data from', new Date(cachedData.lastUpdated).toLocaleTimeString());
        updateTickerItems(cachedData.items);
        setLastUpdated(cachedData.lastUpdated);
        setIsLoading(false);
        
        // Skip API call if cache is fresh enough
        if (now - cachedData.lastUpdated < CACHE_DURATION) {
          console.log('Cache is fresh, skipping API call');
          return;
        }
      }
      
      setIsLoading(true);
      setError(null);
      
      // First try with pax-gold, fallback to gold if that fails
      let response;
      try {
        response = await fetchWithRetry(
          'https://api.coingecko.com/api/v3/coins/markets',
          {
            params: {
              vs_currency: 'usd',
              ids: 'bitcoin,ethereum,pax-gold',
              price_change_percentage: '24h',
            },
          }
        );
      } catch (err) {
        console.log('Failed to fetch pax-gold, trying gold...');
        response = await fetchWithRetry(
          'https://api.coingecko.com/api/v3/coins/markets',
          {
            params: {
              vs_currency: 'usd',
              ids: 'bitcoin,ethereum,gold',
              price_change_percentage: '24h',
            },
          }
        );
      }
      
      const data = response.data.reduce((acc: any, coin: any) => {
        acc[coin.id] = coin;
        return acc;
      }, {});
      
      const btcData = data.bitcoin;
      const ethData = data.ethereum;
      const goldData = data['pax-gold'] || data.gold;
      
      if (!btcData || !ethData || !goldData) {
        console.error('Incomplete data received from API:', { btcData: !!btcData, ethData: !!ethData, goldData: !!goldData });
        throw new Error('Incomplete data received from API');
      }
      
      const btcEthPrice = btcData.current_price / ethData.current_price;
      const btcEthChange24h = ((btcData.price_change_percentage_24h - ethData.price_change_percentage_24h) / 
        (1 + ethData.price_change_percentage_24h / 100)) || 0;
      
      // Gold price per ounce in USD (pax-gold is 1:1 with gold price, but we need to check the actual value)
      // The CoinGecko API returns price per token, and pax-gold is 1 token = 1 troy ounce
      const goldPricePerOz = goldData.current_price;
      
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
    
    // Initial fetch
    console.log('Initial fetch...');
    fetchBtcPrice().catch(err => {
      console.error('Error in initial fetch:', err);
      setError('Failed to load initial data. Using cached data if available.');
    });
    
    // Set up refresh interval
    const intervalId = setInterval(() => {
      console.log('Refreshing data...');
      fetchBtcPrice().catch(err => {
        console.error('Error in refresh:', err);
        setError('Failed to refresh data. Using cached data if available.');
      });
    }, REFRESH_INTERVAL);
    
    // Cleanup
    return () => {
      console.log('Cleaning up...');
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
