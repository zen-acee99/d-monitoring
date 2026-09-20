import React, { useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { MOCK_GEO_DATA } from '@/data/mock';

export function GeoMap() {
  return (
    <MapContainer 
      center={[12.8797, 121.7740]} 
      zoom={6} 
      style={{ height: '100%', width: '100%', background: '#0D1426' }}
      zoomControl={false}
    >
      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
        maxZoom={16}
      />
      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}"
        maxZoom={16}
      />
      {MOCK_GEO_DATA.map((site) => (
        <CircleMarker
          key={site.id}
          center={[site.lat, site.lng]}
          radius={site.status === 'critical' ? 8 : site.status === 'warning' ? 6 : 5}
          fillColor={
            site.status === 'operational' ? '#22c55e' : 
            site.status === 'warning' ? '#f59e0b' : '#ef4444'
          }
          color={
            site.status === 'operational' ? '#22c55e' : 
            site.status === 'warning' ? '#f59e0b' : '#ef4444'
          }
          weight={1}
          fillOpacity={0.7}
        >
          <Popup className="bg-background-tertiary border-border-primary text-text-primary">
            <div className="p-1">
              <p className="font-semibold text-sm mb-1">{site.name}</p>
              <p className="text-xs text-text-muted mb-2">Project: {site.project}</p>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${
                  site.status === 'operational' ? 'bg-status-green' : 
                  site.status === 'warning' ? 'bg-status-yellow' : 'bg-status-red'
                }`} />
                <span className="text-xs uppercase tracking-wider">{site.status}</span>
              </div>
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
