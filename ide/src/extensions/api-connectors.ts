import type { ExtensionManifest, ExtensionContext } from './types';

// Weather API Connector (OpenWeatherMap or wttr.in)
export const weatherConnector: ExtensionManifest = {
  name: 'api-weather',
  version: '1.0.0',
  description: 'Get weather data from OpenWeatherMap or wttr.in',
  author: 'Nexus',
  tags: ['api', 'weather', 'external'],
  hooks: [
    { event: 'onCommand', handler: 'getWeather' },
    { event: 'onFileSave', handler: 'checkWeather' },
  ],
  permissions: ['network:access'],
};

export function getWeather(context: ExtensionContext, city: string, apiKey?: string) {
  const query = city || 'London';
  const useWttr = !apiKey;
  
  const url = useWttr 
    ? `https://wttr.in/${encodeURIComponent(query)}?format=j1`
    : `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(query)}&appid=${apiKey}&units=metric`;
  
  context.emitEvent('weather:fetching', { city: query });
  
  return fetch(url)
    .then(res => res.json())
    .then(data => {
      const result = useWttr ? {
        city: data.nearest_area?.[0]?.areaName?.[0]?.value || query,
        temp: data.current_condition?.[0]?.temp_C || 'N/A',
        condition: data.current_condition?.[0]?.weatherDesc?.[0]?.value || 'Unknown',
        humidity: data.current_condition?.[0]?.humidity || 'N/A',
        wind: data.current_condition?.[0]?.windspeedKmph || 'N/A',
      } : {
        city: data.name,
        temp: data.main.temp,
        condition: data.weather[0].description,
        humidity: data.main.humidity,
        wind: data.wind.speed,
      };
      
      context.emitEvent('weather:complete', result);
      context.setState('lastWeather', result);
      return result;
    })
    .catch(err => {
      context.emitEvent('weather:error', { error: err.message });
      return { error: err.message };
    });
}

// News API Connector (NewsAPI.org)
export const newsConnector: ExtensionManifest = {
  name: 'api-news',
  version: '1.0.0',
  description: 'Fetch news articles from NewsAPI or Hacker News',
  author: 'Nexus',
  tags: ['api', 'news', 'external', 'rss'],
  hooks: [
    { event: 'onCommand', handler: 'getNews' },
    { event: 'onAppStart', handler: 'loadTopStories' },
  ],
  permissions: ['network:access'],
};

export function getNews(context: ExtensionContext, query?: string, apiKey?: string, source: 'newsapi' | 'hackernews' = 'newsapi') {
  context.emitEvent('news:fetching', { query, source });
  
  if (source === 'hackernews') {
    return fetch('https://hacker-news.firebaseio.com/v0/topstories.json')
      .then(res => res.json())
      .then(ids => {
        const topIds = ids.slice(0, 10);
        return Promise.all(
          topIds.map(id => 
            fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`).then(r => r.json())
          )
        );
      })
      .then(stories => {
        const result = stories.map(s => ({
          title: s.title,
          url: s.url,
          score: s.score,
          by: s.by,
          time: new Date(s.time * 1000).toISOString(),
        }));
        context.emitEvent('news:complete', { source: 'hackernews', articles: result });
        context.setState('lastNews', result);
        return result;
      });
  }
  
  // NewsAPI.org
  const api = apiKey || context.getState('newsApiKey') || '';
  const url = query 
    ? `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&sortBy=publishedAt&apiKey=${api}`
    : `https://newsapi.org/v2/top-headlines?country=us&apiKey=${api}`;
  
  return fetch(url)
    .then(res => res.json())
    .then(data => {
      const articles = data.articles?.slice(0, 10) || [];
      context.emitEvent('news:complete', { source: 'newsapi', articles });
      context.setState('lastNews', articles);
      return articles;
    })
    .catch(err => {
      context.emitEvent('news:error', { error: err.message });
      return { error: err.message };
    });
}

// Export all connectors
export const allConnectors = [
  weatherConnector,
  newsConnector,
];
