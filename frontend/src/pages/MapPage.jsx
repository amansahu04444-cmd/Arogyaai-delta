import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { motion } from 'framer-motion';
import { ArrowLeft, RefreshCw, Navigation } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useHospitalRecommendation } from '../hooks/useHospitalRecommendation';

// Fix leafet default icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom Icons
const userIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const hospitalIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Helper component to recenter map
const RecenterMap = ({ lat, lng }) => {
  const map = useMap();
  React.useEffect(() => {
    map.setView([lat, lng]);
  }, [lat, lng, map]);
  return null;
};

const MapPage = () => {
  const navigate = useNavigate();
  const { recommendedHospitals, isLoading, error, userLocation } = useHospitalRecommendation();
  const [selectedHospital, setSelectedHospital] = useState(null);

  // Default to Bhopal if userLocation is null for any reason
  const center = userLocation ? [userLocation.lat, userLocation.lng] : [23.2599, 77.4126];

  // Map settings
  const mapThemeUrl = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
  const mapThemeAttr = '&copy; OpenStreetMap & CARTO';

  return (
    <div className="h-screen w-screen flex flex-col bg-fog text-carbon-black font-sans selection:bg-lime-pulse/30">
      {/* Top Header */}
      <div className="absolute top-0 left-0 w-full z-[1000] p-6 pointer-events-none">
        <div className="flex justify-between items-start max-w-7xl mx-auto">
          <button 
            onClick={() => navigate('/hospitals')}
            className="pointer-events-auto flex items-center gap-2 bg-white px-6 py-3 rounded-2xl border border-carbon-black hover:bg-fog transition-all font-bold uppercase tracking-widest text-[10px] shadow-brutal-sm"
          >
            <ArrowLeft size={16} /> Back
          </button>
          
          <div className="pointer-events-auto bg-white px-6 py-3 rounded-2xl border border-carbon-black shadow-brutal-sm text-center">
            <h1 className="font-bold uppercase tracking-tight text-lg text-carbon-black leading-none">
              Live Map View
            </h1>
            <p className="text-[10px] font-bold text-steel tracking-widest uppercase mt-1">
              {isLoading ? 'Locating Facilities...' : `${recommendedHospitals.length} Hospitals Found`}
            </p>
          </div>
        </div>
      </div>

      {/* Main Map Area */}
      <div className="flex-1 relative z-0">
        {isLoading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-fog z-[500]">
            <div className="w-16 h-16 border-4 border-lime-pulse border-t-carbon-black rounded-full animate-spin shadow-brutal-sm"></div>
            <p className="mt-4 font-bold text-steel uppercase tracking-widest text-xs animate-pulse">Initializing Map...</p>
          </div>
        ) : error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-fog z-[500]">
            <p className="text-red-600 font-bold text-xl mb-4">Error loading map data</p>
            <button 
              onClick={() => window.location.reload()}
              className="flex items-center gap-2 px-6 py-3 bg-white border border-carbon-black rounded-xl hover:bg-fog transition-all font-bold text-xs uppercase tracking-widest shadow-brutal-sm text-carbon-black"
            >
              <RefreshCw size={16} /> Retry
            </button>
          </div>
        ) : (
          <MapContainer 
            center={center} 
            zoom={13} 
            className="h-full w-full"
            zoomControl={false}
          >
            <TileLayer url={mapThemeUrl} attribution={mapThemeAttr} />
            
            {userLocation && <RecenterMap lat={userLocation.lat} lng={userLocation.lng} />}
            
            {/* User Location Marker */}
            {userLocation && (
              <Marker position={[userLocation.lat, userLocation.lng]} icon={userIcon}>
                <Popup className="custom-popup">
                  <div className="font-bold text-center uppercase tracking-widest text-[10px]">Your Location</div>
                </Popup>
              </Marker>
            )}

            {/* Hospital Markers */}
            {recommendedHospitals.map(hospital => (
              hospital.lat && hospital.lng && (
                <Marker 
                  key={hospital.id} 
                  position={[hospital.lat, hospital.lng]} 
                  icon={hospitalIcon}
                  eventHandlers={{
                    click: () => setSelectedHospital(hospital),
                  }}
                >
                  <Popup className="custom-popup">
                    <div className="p-1">
                      <h3 className="font-bold uppercase text-carbon-black leading-tight text-xs mb-1">{hospital.name}</h3>
                      <p className="text-[10px] font-bold text-steel uppercase tracking-widest mb-2">{hospital.type} • {hospital.distance}</p>
                      {hospital.phone && (
                        <p className="text-[10px] font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded border border-green-200 inline-block">{hospital.phone}</p>
                      )}
                    </div>
                  </Popup>
                </Marker>
              )
            ))}

            {/* Connection Line */}
            {selectedHospital && selectedHospital.lat && userLocation && (
              <Polyline 
                positions={[
                  [userLocation.lat, userLocation.lng],
                  [selectedHospital.lat, selectedHospital.lng]
                ]}
                pathOptions={{ color: '#000000', weight: 4, opacity: 0.7, dashArray: '10, 10', lineCap: 'round' }}
              />
            )}
          </MapContainer>
        )}
      </div>

      {/* Selected Hospital Info Card (Bottom floating) */}
      {selectedHospital && (
        <motion.div 
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000] w-full max-w-md px-4 pointer-events-none"
        >
          <div className="bg-white border border-carbon-black p-6 rounded-[20px] shadow-brutal-dark pointer-events-auto">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-bold uppercase tracking-tight leading-none text-carbon-black">{selectedHospital.name}</h3>
                <p className="text-[10px] font-bold text-steel mt-1 uppercase tracking-widest">{selectedHospital.type} Facility</p>
              </div>
              <div className="bg-lime-pulse text-carbon-black border border-carbon-black px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-widest shadow-brutal-sm">
                {selectedHospital.distance}
              </div>
            </div>
            <p className="text-sm font-medium text-carbon-black mb-4 line-clamp-2">{selectedHospital.address}</p>
            <div className="flex gap-3">
              <button 
                onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${selectedHospital.lat},${selectedHospital.lng}`, '_blank')}
                className="flex-1 bg-carbon-black text-white py-3 rounded-xl font-bold uppercase tracking-widest text-[10px] flex justify-center items-center gap-2 hover:bg-carbon-black/90 shadow-brutal-sm"
              >
                <Navigation size={16} /> Navigate
              </button>
            </div>
          </div>
        </motion.div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        .leaflet-container {
          background: #f5f5f5;
          z-index: 0;
        }
        .leaflet-popup-content-wrapper {
          background: white;
          color: black;
          border-radius: 12px;
          border: 1px solid black;
          box-shadow: 4px 4px 0px rgba(23, 23, 23, 1) !important;
        }
        .leaflet-popup-tip {
          background: white;
          border: 1px solid black;
          border-top: none;
          border-left: none;
        }
      `}} />
    </div>
  );
};

export default MapPage;
