import { WeatherData } from '../types';

export const fetchWeather = async (lat: number, lon: number): Promise<WeatherData> => {
  try {
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`
    );
    
    if (!response.ok) {
      throw new Error('Weather service unavailable');
    }

    const data = await response.json();
    
    return {
      temperature: data.current_weather.temperature,
      conditionCode: data.current_weather.weathercode,
      isDay: data.current_weather.is_day === 1
    };
  } catch (error) {
    console.error("Failed to fetch weather", error);
    // Return a default fallback
    return {
      temperature: 20,
      conditionCode: 0,
      isDay: true
    };
  }
};