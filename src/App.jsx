import { useEffect, useMemo, useState } from 'react'
import './App.css'

const DEFAULT_CITY_LABEL = 'Your Location'

function App() {
  const [temperature, setTemperature] = useState(null)
  const [feelsLike, setFeelsLike] = useState(null)
  const [weatherCode, setWeatherCode] = useState(null)
  const [windSpeed, setWindSpeed] = useState(null)
  const [windDirection, setWindDirection] = useState(null)
  const [humidity, setHumidity] = useState(null)
  const [sunrise, setSunrise] = useState(null)
  const [sunset, setSunset] = useState(null)
  const [uvIndex, setUvIndex] = useState(null)

  const [forecast, setForecast] = useState([])
  const [hourlyForecast, setHourlyForecast] = useState([])
  const [insights, setInsights] = useState([])
  const [activeInsight, setActiveInsight] = useState(0)

  const [latitude, setLatitude] = useState(null)
  const [longitude, setLongitude] = useState(null)

  const [location, setLocation] = useState('')
  const [searchLocation, setSearchLocation] = useState('')
  const [userLocationName, setUserLocationName] = useState('')
  const [isSearchLocation, setIsSearchLocation] = useState(false)
  const [locationLoading, setLocationLoading] = useState(true)

  const [darkMode, setDarkMode] = useState(
    localStorage.getItem('darkMode') === 'true'
  )

  const [favorites, setFavorites] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('weatherFavorites')) || []
    } catch {
      return []
    }
  })

  const [showFavorites, setShowFavorites] = useState(false)

  useEffect(() => {
    localStorage.setItem('darkMode', darkMode)
  }, [darkMode])

  useEffect(() => {
    localStorage.setItem('weatherFavorites', JSON.stringify(favorites))
  }, [favorites])

  // Ask for the user's location on first load.
  useEffect(() => {
    if (isSearchLocation) return

    if (!navigator.geolocation) {
      setLocationLoading(false)
      alert('Location services are not supported by your browser.')
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (isSearchLocation) return

        const userLatitude = position.coords.latitude
        const userLongitude = position.coords.longitude

        setLatitude(userLatitude)
        setLongitude(userLongitude)
        setLocationLoading(false)

        fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${userLatitude}&lon=${userLongitude}&format=json`
        )
          .then((response) => response.json())
          .then((data) => {
            const address = data.address || {}

            const area =
              address.suburb ||
              address.neighbourhood ||
              address.city_district ||
              address.town ||
              address.city

            const city =
              address.city ||
              address.town ||
              address.municipality

            if (area && city && area !== city) {
              setUserLocationName(`${area}, ${city}`)
            } else if (area) {
              setUserLocationName(area)
            }
          })
          .catch((error) => {
            console.error('Location name error:', error)
          })
      },
      () => {
        setLocationLoading(false)
        alert('Location access was denied. Please search for your city.')
      }
    )
  }, [isSearchLocation])

  // Get current, hourly and daily weather.
  useEffect(() => {
    if (latitude === null || longitude === null) return

    fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,relative_humidity_2m&hourly=temperature_2m,weather_code,precipitation_probability,uv_index,apparent_temperature&daily=temperature_2m_max,temperature_2m_min,weather_code,sunrise,sunset,uv_index_max,precipitation_probability_max&past_days=1&forecast_days=8&timezone=auto`
    )
      .then((response) => response.json())
      .then((data) => {
        const current = data.current

        setTemperature(current.temperature_2m)
        setFeelsLike(current.apparent_temperature)
        setWeatherCode(current.weather_code)
        setWindSpeed(current.wind_speed_10m)
        setWindDirection(current.wind_direction_10m)
        setHumidity(current.relative_humidity_2m)

        const todayDate = current.time.split('T')[0]
        const todayIndex = data.daily.time.findIndex(
          (date) => date === todayDate
        )

        const safeTodayIndex = todayIndex >= 0 ? todayIndex : 1

        setUvIndex(data.daily.uv_index_max[safeTodayIndex])
        setSunrise(data.daily.sunrise[safeTodayIndex])
        setSunset(data.daily.sunset[safeTodayIndex])

        const todayHourly = data.hourly.time
          .map((time, index) => ({
            time,
            temperature: data.hourly.temperature_2m[index],
            feelsLike: data.hourly.apparent_temperature[index],
            weather_code: data.hourly.weather_code[index],
            rainProbability:
              data.hourly.precipitation_probability[index] ?? 0,
            uvIndex: data.hourly.uv_index[index] ?? 0,
          }))
          .filter((hour) => hour.time.startsWith(todayDate))

        setHourlyForecast(todayHourly)

        const dailyForecast = data.daily.time
          .map((time, index) => ({
            time,
            temperature_2m_max: data.daily.temperature_2m_max[index],
            temperature_2m_min: data.daily.temperature_2m_min[index],
            weather_code: data.daily.weather_code[index],
            sunrise: data.daily.sunrise[index],
            sunset: data.daily.sunset[index],
            uv_index_max: data.daily.uv_index_max[index],
            precipitation_probability_max:
              data.daily.precipitation_probability_max[index] ?? 0,
          }))
          .filter((day) => day.time >= todayDate)
          .slice(0, 7)

        setForecast(dailyForecast)
        createInsights(data, todayDate, todayHourly, dailyForecast)
      })
      .catch((error) => {
        console.error('Weather error:', error)
      })
  }, [latitude, longitude])

  // Automatically rotate insight cards.
  useEffect(() => {
    if (insights.length <= 1) return

    const interval = setInterval(() => {
      setActiveInsight((current) => (current + 1) % insights.length)
    }, 5000)

    return () => clearInterval(interval)
  }, [insights])

  const handleSearch = () => {
    if (location.trim() === '') return

    fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
        location
      )}&count=1&language=en&format=json`
    )
      .then((response) => response.json())
      .then((data) => {
        if (data.results && data.results.length > 0) {
          const city = data.results[0]

          setSearchLocation(city.name)
          setUserLocationName(
            city.country ? `${city.name}, ${city.country}` : city.name
          )
          setLatitude(city.latitude)
          setLongitude(city.longitude)
          setIsSearchLocation(true)
          setLocation('')
          setShowFavorites(false)
        } else {
          alert('City not found')
        }
      })
      .catch(() => {
        alert('Unable to search for city')
      })
  }

  const handleKeyDown = (event) => {
    if (event.key === 'Enter') handleSearch()
  }

  const useMyLocation = () => {
    setIsSearchLocation(false)
    setSearchLocation('')
    setUserLocationName('')
    setLocationLoading(true)

    if (!navigator.geolocation) {
      setLocationLoading(false)
      alert('Location services are not supported by your browser.')
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude)
        setLongitude(position.coords.longitude)
        setLocationLoading(false)

        fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${position.coords.latitude}&lon=${position.coords.longitude}&format=json`
        )
          .then((response) => response.json())
          .then((data) => {
            const address = data.address || {}
            const area =
              address.suburb ||
              address.neighbourhood ||
              address.city_district ||
              address.town ||
              address.city
            const city =
              address.city ||
              address.town ||
              address.municipality

            if (area && city && area !== city) {
              setUserLocationName(`${area}, ${city}`)
            } else if (area) {
              setUserLocationName(area)
            }
          })
          .catch((error) => console.error('Location name error:', error))
      },
      () => {
        setLocationLoading(false)
        alert('Location access was denied. Please search for your city.')
      }
    )
  }

  const saveCurrentFavorite = () => {
    const name = userLocationName || searchLocation || DEFAULT_CITY_LABEL

    if (latitude === null || longitude === null) return

    const alreadySaved = favorites.some(
      (favorite) =>
        Math.abs(favorite.latitude - latitude) < 0.01 &&
        Math.abs(favorite.longitude - longitude) < 0.01
    )

    if (alreadySaved) {
      setFavorites((current) =>
        current.filter(
          (favorite) =>
            Math.abs(favorite.latitude - latitude) >= 0.01 ||
            Math.abs(favorite.longitude - longitude) >= 0.01
        )
      )
      return
    }

    setFavorites((current) => [
      ...current,
      {
        id: Date.now(),
        name,
        latitude,
        longitude,
      },
    ])
  }

  const openFavorite = (favorite) => {
    setSearchLocation(favorite.name)
    setUserLocationName(favorite.name)
    setLatitude(favorite.latitude)
    setLongitude(favorite.longitude)
    setIsSearchLocation(true)
    setShowFavorites(false)
  }

  const removeFavorite = (id) => {
    setFavorites((current) => current.filter((favorite) => favorite.id !== id))
  }

  const isCurrentFavorite = favorites.some(
    (favorite) =>
      latitude !== null &&
      longitude !== null &&
      Math.abs(favorite.latitude - latitude) < 0.01 &&
      Math.abs(favorite.longitude - longitude) < 0.01
  )

  const getWeatherDescription = (code) => {
    if (code === 0) return 'Clear sky'
    if (code === 1) return 'Mainly clear'
    if (code === 2) return 'Partly cloudy'
    if (code === 3) return 'Cloudy'
    if (code >= 45 && code <= 48) return 'Foggy'
    if (code >= 51 && code <= 67) return 'Rain'
    if (code >= 71 && code <= 77) return 'Snow'
    if (code >= 80 && code <= 82) return 'Rain showers'
    if (code >= 85 && code <= 86) return 'Snow showers'
    if (code >= 95 && code <= 99) return 'Thunderstorm'
    return 'Unknown weather'
  }

  const getWeatherIcon = (code) => {
    if (code === 0) return '☀️'
    if (code === 1) return '🌤️'
    if (code === 2) return '⛅'
    if (code === 3) return '☁️'
    if (code >= 45 && code <= 48) return '🌫️'
    if (code >= 51 && code <= 67) return '🌧️'
    if (code >= 71 && code <= 77) return '❄️'
    if (code >= 80 && code <= 82) return '🌦️'
    if (code >= 85 && code <= 86) return '🌨️'
    if (code >= 95 && code <= 99) return '⛈️'
    return '🌤️'
  }

  const formatTime = (time) => {
    if (!time) return '--:--'

    return new Date(time).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  }

  const getDayName = (date, index) => {
    if (index === 0) return 'Today'

    return new Date(`${date}T12:00:00`).toLocaleDateString('en-US', {
      weekday: 'short',
    })
  }

  const getUvDescription = (uv) => {
    if (uv >= 11) return 'Extreme'
    if (uv >= 8) return 'Very high'
    if (uv >= 6) return 'High'
    if (uv >= 3) return 'Moderate'
    return 'Low'
  }

  const getUvClass = (uv) => {
    if (uv >= 11) return 'uv-extreme'
    if (uv >= 8) return 'uv-very-high'
    if (uv >= 6) return 'uv-high'
    if (uv >= 3) return 'uv-moderate'
    return 'uv-low'
  }

  const getWindDirection = (degrees) => {
    if (degrees === null || degrees === undefined) return '--'

    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
    return directions[Math.round(degrees / 45) % 8]
  }

  const createInsights = (data, todayDate, todayHourly, dailyForecast) => {
    const newInsights = []
    const today = dailyForecast[0]
    const tomorrow = dailyForecast[1]

    const stormHour = todayHourly.find((hour) => hour.weather_code >= 95)

    if (stormHour) {
      newInsights.push({
        icon: '⛈️',
        title: 'Storms possible',
        text: `Thunderstorms are possible around ${formatTime(
          stormHour.time
        )}. Keep an eye on the sky.`,
      })
    }

    const rainHour = todayHourly.find((hour) => hour.rainProbability >= 50)

    if (rainHour) {
      newInsights.push({
        icon: '☔',
        title: 'Rain expected',
        text: `Rain chances reach ${rainHour.rainProbability}% around ${formatTime(
          rainHour.time
        )}. Consider carrying an umbrella.`,
      })
    }

    if (today && today.uv_index_max >= 8) {
      newInsights.push({
        icon: '☀️',
        title: 'Protect your skin',
        text: `UV will be ${getUvDescription(
          today.uv_index_max
        )} today. Limit direct sun around the strongest part of the day.`,
      })
    }

    if (data.daily.temperature_2m_max.length >= 2 && today) {
      const yesterdayHigh = data.daily.temperature_2m_max[0]
      const todayHigh = today.temperature_2m_max
      const difference = Math.round(Math.abs(todayHigh - yesterdayHigh))

      if (todayHigh > yesterdayHigh + 1) {
        newInsights.push({
          icon: '📈',
          title: 'Warmer than yesterday',
          text: `Today's high is about ${difference}° higher than yesterday.`,
        })
      }

      if (todayHigh < yesterdayHigh - 1) {
        newInsights.push({
          icon: '🧥',
          title: 'Cooler than yesterday',
          text: `Temperatures are about ${difference}° lower today. A jacket may be useful.`,
        })
      }
    }

    if (today && today.temperature_2m_min <= 12) {
      newInsights.push({
        icon: '🧥',
        title: 'Grab a jacket',
        text: `Temperatures could fall to ${Math.round(
          today.temperature_2m_min
        )}°C. Keep a jacket nearby.`,
      })
    }

    if (tomorrow) {
      newInsights.push({
        icon: getWeatherIcon(tomorrow.weather_code),
        title: "Tomorrow's outlook",
        text: `${getWeatherDescription(
          tomorrow.weather_code
        )} tomorrow, with a high of ${Math.round(
          tomorrow.temperature_2m_max
        )}°C and a ${tomorrow.precipitation_probability_max}% chance of rain.`,
      })
    }

    if (today) {
      newInsights.push({
        icon: '🌅',
        title: 'Sunrise & sunset',
        text: `Sunrise is at ${formatTime(
          today.sunrise
        )} and sunset is at ${formatTime(today.sunset)}.`,
      })
    }

    if (newInsights.length === 0) {
      newInsights.push({
        icon: '🌤️',
        title: 'Looking good',
        text: 'No major weather alerts are currently detected in the forecast.',
      })
    }

    setInsights(newInsights)
    setActiveInsight(0)
  }

  const temperatureTrend = useMemo(() => {
    if (hourlyForecast.length < 2) return null

    const values = hourlyForecast.map((hour) => hour.temperature)
    const min = Math.min(...values)
    const max = Math.max(...values)
    const range = Math.max(max - min, 1)

    const width = 100
    const height = 42

    const points = hourlyForecast
      .map((hour, index) => {
        const x = (index / (hourlyForecast.length - 1)) * width
        const y = height - ((hour.temperature - min) / range) * 32 - 5
        return `${x},${y}`
      })
      .join(' ')

    return { points, min, max }
  }, [hourlyForecast])

  const locationTitle =
    userLocationName || searchLocation || DEFAULT_CITY_LABEL

  return (
    <div className={darkMode ? 'app dark-mode' : 'app'}>
      <header className="site-header">
        <div className="header-glow header-glow-one"></div>
        <div className="header-glow header-glow-two"></div>

        <div className="header-top">
          <div className="brand">
            <div className="brand-mark">🌤️</div>
            <div>
              <h1>Daily Weather</h1>
              <p>Smart weather updates for wherever you are</p>
            </div>
          </div>

          <div className="header-actions">
            <button className="location-button" onClick={useMyLocation}>
              📍 My location
            </button>

            <div className="theme-switch">
              <span>{darkMode ? '🌙' : '☀️'}</span>
              <button
                className={darkMode ? 'toggle active' : 'toggle'}
                onClick={() => setDarkMode(!darkMode)}
                aria-label="Toggle dark mode"
              >
                <span className="toggle-circle"></span>
              </button>
            </div>
          </div>
        </div>

        <div className="search-area">
          <div className="search-box">
            <span className="search-icon">⌕</span>
            <input
              type="text"
              placeholder="Search for a city..."
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              onKeyDown={handleKeyDown}
            />
            {location && (
              <button
                className="clear-search"
                onClick={() => setLocation('')}
                aria-label="Clear search"
              >
                ×
              </button>
            )}
            <button className="search-button" onClick={handleSearch}>
              Search
            </button>
          </div>
        </div>

        {favorites.length > 0 && (
          <div className="favorites-wrap">
            <button
              className="favorites-trigger"
              onClick={() => setShowFavorites(!showFavorites)}
            >
              ⭐ Favorites <span>{favorites.length}</span>
            </button>

            {showFavorites && (
              <div className="favorites-menu">
                {favorites.map((favorite) => (
                  <div className="favorite-row" key={favorite.id}>
                    <button onClick={() => openFavorite(favorite)}>
                      <span>📍</span>
                      <span>{favorite.name}</span>
                    </button>
                    <button
                      className="remove-favorite"
                      onClick={() => removeFavorite(favorite.id)}
                      aria-label={`Remove ${favorite.name}`}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </header>

      <main>
        <section className="hero-weather">
          <div className="hero-topline">
            <div>
              <p className="small-label">CURRENT WEATHER</p>
              <h2>📍 {locationTitle}</h2>
              <p className="updated-label">
                {locationLoading ? 'Finding your location...' : 'Live forecast'}
              </p>
            </div>

            <button
              className={isCurrentFavorite ? 'favorite-button saved' : 'favorite-button'}
              onClick={saveCurrentFavorite}
              title={
                isCurrentFavorite
                  ? 'Remove from favorites'
                  : 'Save this location'
              }
            >
              {isCurrentFavorite ? '★ Saved' : '☆ Save location'}
            </button>
          </div>

          <div className="hero-grid">
            <div className="hero-main">
              <div className="hero-icon">
                {weatherCode !== null ? getWeatherIcon(weatherCode) : '🌤️'}
              </div>

              <div className="hero-temperature-wrap">
                <div className="hero-temperature">
                  {temperature !== null
                    ? `${Math.round(temperature)}°`
                    : '--°'}
                </div>
                <div className="hero-unit">C</div>
                <div className="hero-description">
                  {weatherCode !== null
                    ? getWeatherDescription(weatherCode)
                    : 'Loading weather...'}
                </div>
                <div className="feels-like">
                  Feels like {feelsLike !== null ? `${Math.round(feelsLike)}°C` : '--'}
                </div>
              </div>
            </div>

            <div className="hero-details">
              <div className="metric-card">
                <span className="metric-icon">💨</span>
                <div>
                  <small>Wind</small>
                  <strong>{windSpeed !== null ? `${Math.round(windSpeed)} km/h` : '--'}</strong>
                  <span>{getWindDirection(windDirection)}</span>
                </div>
              </div>

              <div className="metric-card">
                <span className="metric-icon">💧</span>
                <div>
                  <small>Humidity</small>
                  <strong>{humidity !== null ? `${humidity}%` : '--'}</strong>
                  <span>Air moisture</span>
                </div>
              </div>

              <div className={`metric-card uv-card ${getUvClass(uvIndex || 0)}`}>
                <span className="metric-icon">☀️</span>
                <div>
                  <small>UV Index</small>
                  <strong>{uvIndex !== null ? uvIndex : '--'}</strong>
                  <span>{uvIndex !== null ? getUvDescription(uvIndex) : '--'}</span>
                </div>
              </div>

              <div className="metric-card">
                <span className="metric-icon">🌅</span>
                <div>
                  <small>Sunrise</small>
                  <strong>{formatTime(sunrise)}</strong>
                  <span>First light</span>
                </div>
              </div>

              <div className="metric-card">
                <span className="metric-icon">🌇</span>
                <div>
                  <small>Sunset</small>
                  <strong>{formatTime(sunset)}</strong>
                  <span>Daylight ends</span>
                </div>
              </div>
            </div>
          </div>

          <div className="sun-path">
            <div className="sun-path-label">
              <span>🌅 {formatTime(sunrise)}</span>
              <span>☀️ Daylight</span>
              <span>🌇 {formatTime(sunset)}</span>
            </div>
            <div className="sun-track">
              <div className="sun-progress"></div>
              <div className="sun-orb">☀️</div>
            </div>
          </div>
        </section>

        <section className="hourly-section">
          <div className="section-heading">
            <div>
              <p className="small-label">TODAY</p>
              <h2>Hourly Weather</h2>
              <p className="section-subtitle">
                Temperature, conditions and rain probability through the day
              </p>
            </div>
            <div className={`uv-summary ${getUvClass(uvIndex || 0)}`}>
              ☀️ UV {uvIndex !== null ? uvIndex : '--'} ·{' '}
              {uvIndex !== null ? getUvDescription(uvIndex) : '--'}
            </div>
          </div>

          <div className="hourly-container">
            {hourlyForecast.map((hour) => (
              <div className="hourly-card" key={hour.time}>
                <p className="hourly-time">{formatTime(hour.time)}</p>
                <div className="hourly-icon">{getWeatherIcon(hour.weather_code)}</div>
                <strong className="hourly-temperature">
                  {Math.round(hour.temperature)}°
                </strong>
                <div className="rain-probability">
                  💧 {hour.rainProbability ?? 0}%
                </div>
                <span className="hourly-description">
                  {getWeatherDescription(hour.weather_code)}
                </span>
              </div>
            ))}
          </div>
        </section>

        {temperatureTrend && (
          <section className="trend-section">
            <div className="section-heading">
              <div>
                <p className="small-label">24-HOUR TREND</p>
                <h2>Temperature outlook</h2>
                <p className="section-subtitle">
                  See how the temperature changes throughout today
                </p>
              </div>

              <div className="trend-range">
                <strong>{Math.round(temperatureTrend.max)}°</strong>
                <span>High</span>
                <strong>{Math.round(temperatureTrend.min)}°</strong>
                <span>Low</span>
              </div>
            </div>

            <div className="temperature-chart">
              <div className="chart-y-labels">
                <span>{Math.round(temperatureTrend.max)}°</span>
                <span>{Math.round((temperatureTrend.max + temperatureTrend.min) / 2)}°</span>
                <span>{Math.round(temperatureTrend.min)}°</span>
              </div>

              <div className="chart-area">
                <div className="chart-grid-line top"></div>
                <div className="chart-grid-line middle"></div>
                <div className="chart-grid-line bottom"></div>

                <svg
                  className="chart-svg"
                  viewBox="0 0 100 42"
                  preserveAspectRatio="none"
                  aria-label="24 hour temperature trend"
                >
                  <polyline
                    points={temperatureTrend.points}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>

                <div className="chart-hours">
                  {hourlyForecast
                    .filter((_, index) => index % 4 === 0)
                    .map((hour) => (
                      <span key={hour.time}>{formatTime(hour.time)}</span>
                    ))}
                </div>
              </div>
            </div>
          </section>
        )}

        <section className="rain-section">
          <div className="section-heading">
            <div>
              <p className="small-label">PRECIPITATION</p>
              <h2>Rain chances</h2>
              <p className="section-subtitle">
                Plan your day around the wettest periods
              </p>
            </div>
          </div>

          <div className="rain-timeline">
            {hourlyForecast
              .filter((_, index) => index % 2 === 0)
              .map((hour) => (
                <div className="rain-point" key={hour.time}>
                  <span>{formatTime(hour.time)}</span>
                  <div className="rain-bar">
                    <div
                      className="rain-fill"
                      style={{
                        height: `${Math.max(hour.rainProbability, 5)}%`,
                      }}
                    ></div>
                  </div>
                  <strong>{hour.rainProbability}%</strong>
                </div>
              ))}
          </div>
        </section>

        {insights.length > 0 && (
          <section className="insights-section">
            <div className="section-heading">
              <div>
                <p className="small-label">WEATHER INSIGHTS</p>
                <h2>What to expect</h2>
                <p className="section-subtitle">
                  Useful updates based on your forecast
                </p>
              </div>
            </div>

            <div className="insight-slider">
              <button
                className="insight-arrow"
                onClick={() =>
                  setActiveInsight(
                    (activeInsight - 1 + insights.length) % insights.length
                  )
                }
                aria-label="Previous insight"
              >
                ‹
              </button>

              <div className="insight-content">
                <div className="insight-icon">{insights[activeInsight].icon}</div>
                <div>
                  <h3>{insights[activeInsight].title}</h3>
                  <p>{insights[activeInsight].text}</p>
                </div>
              </div>

              <button
                className="insight-arrow"
                onClick={() =>
                  setActiveInsight((activeInsight + 1) % insights.length)
                }
                aria-label="Next insight"
              >
                ›
              </button>
            </div>

            <div className="insight-dots">
              {insights.map((_, index) => (
                <button
                  key={index}
                  className={
                    index === activeInsight
                      ? 'insight-dot active'
                      : 'insight-dot'
                  }
                  onClick={() => setActiveInsight(index)}
                  aria-label={`Show insight ${index + 1}`}
                ></button>
              ))}
            </div>
          </section>
        )}

        <section className="forecast-section">
          <div className="section-heading">
            <div>
              <p className="small-label">FORECAST</p>
              <h2>Upcoming Weather</h2>
              <p className="section-subtitle">
                Your seven-day weather outlook
              </p>
            </div>
          </div>

          <div className="daily-container">
            {forecast.map((day, index) => (
              <div className="daily-card" key={day.time}>
                <div className="daily-top">
                  <h3>{getDayName(day.time, index)}</h3>
                  {index === 0 && <span className="today-pill">Today</span>}
                </div>

                <div className="daily-icon">{getWeatherIcon(day.weather_code)}</div>

                <p className="daily-description">
                  {getWeatherDescription(day.weather_code)}
                </p>

                <div className="temperature-range">
                  <strong>{Math.round(day.temperature_2m_max)}°</strong>
                  <span>{Math.round(day.temperature_2m_min)}°</span>
                </div>

                <div className="high-low">
                  <span>High</span>
                  <span>Low</span>
                </div>

                <div className="daily-stat">
                  💧 {day.precipitation_probability_max}% rain
                </div>

                <div className="daily-sun">
                  <span>🌅 {formatTime(day.sunrise)}</span>
                  <span>🌇 {formatTime(day.sunset)}</span>
                </div>

                <div className={`daily-uv ${getUvClass(day.uv_index_max)}`}>
                  ☀️ UV {day.uv_index_max} · {getUvDescription(day.uv_index_max)}
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer>
        <div className="footer-content">
          <div className="footer-brand">🌤️ Daily Weather</div>
          <p>Developed by Bandile</p>

          <p>
            📧{' '}
            <a href="mailto:bandilebandile922@gmail.com">
              bandilebandile922@gmail.com
            </a>
          </p>

          <p className="weather-credit">
            Weather data provided by Open-Meteo
          </p>
        </div>
      </footer>
    </div>
  )
}

export default App
