# X-Dispatch

X-Plane lacks an interactive world map for exploring airports and selecting start positions visually. You either memorize gate names, use third-party tools, or guess. This app solves that.

Browse any airport with a detailed map showing runways, taxiways, gates, and markings. Select your starting position by clicking on it. Choose your aircraft, configure the flight, and launch X-Plane directly.

I wanted to explore X-Plane airports interactively and start flights without memorizing gate names or clicking through menus. Nothing did exactly what I wanted, so I built it.

## Features

### Airport Visualization
- Runways with surface types, dimensions, and lighting indicators
- Taxiways, aprons, and pavement areas
- Runway and taxiway markings
- Signs, windsocks, and airport boundaries
- Runway, taxiway, and approach lighting systems
- Gates and parking positions with heading indicators

### Navigation Data
- VORs, NDBs, DMEs, and ILS/LOC
- Waypoints and fixes
- High and low altitude airways
- Controlled airspace boundaries
- SID, STAR, and approach procedures with route visualization

### Weather
- Live METAR with decoded wind, visibility, ceiling, clouds, temperature
- TAF forecasts
- Flight category display (VFR/MVFR/IFR/LIFR)

### Live Traffic
- Real-time VATSIM network traffic overlay
- Configurable refresh interval

### Flight Launcher
- Aircraft browser with search and filtering
- Filter by manufacturer or category
- Favorites system for quick access
- Livery selection with previews
- Fuel load configuration
- Time of day selection with sun position arc
- Weather presets (Clear, Few Clouds, Scattered, Overcast, Rainy, Stormy, Foggy)
- Start from any gate or runway threshold
- Launches X-Plane directly via command line

### Settings
- Auto-detection of X-Plane installations
- Multiple map style presets (OpenFreeMap, CARTO) or custom URL
- Light, dark, and system theme modes
- Configurable nav data search radius
- Multi-language support

### Data Support
- Reads X-Plane native data files (apt.dat, earth_nav.dat, earth_fix.dat, earth_awy.dat, CIFP)
- Navigraph and other nav data providers via Custom Data folder
- Fast SQLite storage for queries

## Requirements

- X-Plane 12
- Node.js 18+

## Development

```
npm install
npm start
```

## Build

```
npm run make
```

## How it works

Parses X-Plane data files on startup and stores them in SQLite. The map renders airport geometry and nav data using MapLibre GL and Deck.GL. Selecting a start position and aircraft generates a Freeflight.prf file, then launches X-Plane via command line 
## License

MIT
