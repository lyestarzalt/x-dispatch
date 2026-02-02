# X-Dispatch

Interactive airport map and flight launcher for X-Plane 12.

X-Plane shows airport diagrams but has no global map to explore and discover airports. You need to already know the ICAO code to load an airport. This app gives you a world map to browse, search, and explore all airports visually.

Click on any airport to see detailed maps with runways, taxiways, gates, and markings. Select a start position, configure your flight, and launch X-Plane directly.

## Features

### Airport Visualization

- Runways with surface types, dimensions, and lighting
- Taxiways, aprons, and pavement areas
- Runway and taxiway markings
- Signs, windsocks, and airport boundaries
- Runway, taxiway, and approach lighting systems
- Gates and parking positions with heading indicators

### Navigation Data

- VORs, NDBs, DMEs, and ILS/LOC with course lines
- Waypoints and fixes
- High and low altitude airways
- Controlled airspace boundaries
- SID, STAR, and approach procedures with route visualization
- Transition altitude display (with Navigraph data)

### Weather

- Live METAR with decoded wind, visibility, ceiling, clouds, temperature
- TAF forecasts
- Flight category display (VFR/MVFR/IFR/LIFR)

### Live Traffic

- Real-time VATSIM network overlay
- Pilot callsigns, aircraft types, and flight info

### Flight Launcher

- Aircraft browser with search and filtering
- Filter by manufacturer or category
- Favorites system
- Livery selection with previews
- Fuel load configuration
- Time of day with sun position arc
- Weather presets
- Start from any gate or runway
- Direct X-Plane launch

### Data Sources

- X-Plane native files (apt.dat, earth_nav.dat, earth_fix.dat, earth_awy.dat, CIFP)
- Navigraph nav data with AIRAC cycle detection
- ATC frequencies (Navigraph)
- Airport metadata with transition altitudes
- Custom scenery airport support

## How It Works

1. Point the app to your X-Plane installation
2. It parses X-Plane's data files (apt.dat, nav data, CIFP procedures) and caches them in SQLite
3. Browse the world map and click any airport
4. The airport renders with full geometry from apt.dat
5. Select a gate or runway, pick your aircraft, configure the flight
6. The app writes a `Freeflight.prf` file and launches X-Plane with your configuration

## Requirements

- X-Plane 12
- Node.js 18+

## Development

```bash
npm install
npm start
```

## Build

```bash
npm run make
```

## License

MIT
