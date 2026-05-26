export type WeatherHourly = {
  time:        string
  tempC:       number
  weatherCode: number
  precipPct:   number
  windKmh:     number
  uv:          number
}

export type WeatherCurrent = {
  tempC:        number
  feelsLikeC:   number
  windKmh:      number
  windDir:      number
  humidityPct:  number
  precipPct:    number
  weatherCode:  number
  sunriseISO:   string
  sunsetISO:    string
}

export type AirQuality = { europeanAqi: number }
export type UvSummary  = { index: number }

export type WeatherResponse = {
  current:     WeatherCurrent
  hourly:      WeatherHourly[]
  uv:          UvSummary
  airQuality:  AirQuality
  generatedAt: string
}

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast'
const AQI_URL      = 'https://air-quality-api.open-meteo.com/v1/air-quality'

export async function fetchOpenMeteo(lat: number, lng: number): Promise<WeatherResponse> {
  const forecastParams = new URLSearchParams({
    latitude:  String(lat),
    longitude: String(lng),
    current:   'temperature_2m,apparent_temperature,relative_humidity_2m,precipitation_probability,weather_code,wind_speed_10m,wind_direction_10m',
    hourly:    'temperature_2m,weather_code,precipitation_probability,wind_speed_10m,uv_index',
    daily:     'sunrise,sunset,uv_index_max',
    timezone:  'auto',
    forecast_days: '1',
  })
  const aqiParams = new URLSearchParams({
    latitude:  String(lat),
    longitude: String(lng),
    current:   'european_aqi',
  })

  const [forecastRes, aqiRes] = await Promise.all([
    fetch(`${FORECAST_URL}?${forecastParams}`),
    fetch(`${AQI_URL}?${aqiParams}`),
  ])

  if (!forecastRes.ok) throw new Error(`Open-Meteo forecast error: ${forecastRes.status}`)
  if (!aqiRes.ok)      throw new Error(`Open-Meteo air-quality error: ${aqiRes.status}`)

  const forecast = await forecastRes.json() as any
  const aqi      = await aqiRes.json() as any

  const cur = forecast.current
  const dly = forecast.daily
  const h   = forecast.hourly

  const current: WeatherCurrent = {
    tempC:        Math.round(cur.temperature_2m),
    feelsLikeC:   Math.round(cur.apparent_temperature),
    windKmh:      Math.round(cur.wind_speed_10m),
    windDir:      cur.wind_direction_10m,
    humidityPct:  Math.round(cur.relative_humidity_2m),
    precipPct:    Math.round(cur.precipitation_probability ?? 0),
    weatherCode:  cur.weather_code,
    sunriseISO:   dly.sunrise[0],
    sunsetISO:    dly.sunset[0],
  }

  const hourly: WeatherHourly[] = h.time.slice(0, 24).map((t: string, i: number) => ({
    time:        t,
    tempC:       Math.round(h.temperature_2m[i]),
    weatherCode: h.weather_code[i],
    precipPct:   Math.round(h.precipitation_probability?.[i] ?? 0),
    windKmh:     Math.round(h.wind_speed_10m[i]),
    uv:          Math.round((h.uv_index?.[i] ?? 0) * 10) / 10,
  }))

  return {
    current,
    hourly,
    uv:         { index: Math.round((dly.uv_index_max?.[0] ?? 0) * 10) / 10 },
    airQuality: { europeanAqi: Math.round(aqi.current.european_aqi ?? 0) },
    generatedAt: new Date().toISOString(),
  }
}
