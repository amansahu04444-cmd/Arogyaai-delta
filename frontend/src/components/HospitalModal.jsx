import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Phone, MapPin, Navigation, Star, Clock, ShieldCheck, Stethoscope, Building2 } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import CardWrapper from './CardWrapper';

// Fix Leaflet's default icon issue with webpack/vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom Icons
const userIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const hospitalIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Component to fit bounds and refresh map size
const MapRefresher = ({ bounds }) => {
  const map = useMap();
  React.useEffect(() => {
    const timer = setTimeout(() => {
      // Force map to recalculate its size after modal animation
      map.invalidateSize();
      if (bounds && bounds.length === 2) {
        map.fitBounds(bounds, { padding: [50, 50], animate: true });
      }
    }, 200);
    
    return () => clearTimeout(timer);
  }, [map, bounds]);
  return null;
};

const HospitalModal = ({ hospital, isOpen, onClose, userLocation }) => {
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      const timer = setTimeout(() => {
        setIsLoading(false);
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [isOpen, hospital]);

  const mapBounds = useMemo(() => {
    if (hospital?.lat && hospital?.lng && userLocation?.lat && userLocation?.lng) {
      return [
        [userLocation.lat, userLocation.lng],
        [hospital.lat, hospital.lng]
      ];
    }
    return null;
  }, [hospital, userLocation]);

  if (!hospital) return null;

  if (isLoading) {
    return (
      <CardWrapper isOpen={isOpen} onClose={onClose} maxWidth="max-w-5xl">
        {/* Left side skeleton */}
        <div className="p-8 md:p-10 flex-grow w-full md:w-1/2 overflow-y-auto max-h-[80vh] md:max-h-[90vh] text-carbon-black animate-pulse space-y-6">
          <div className="flex gap-2 items-center">
            <div className="h-6 w-24 bg-steel/20 rounded-xl"></div>
            <div className="h-5 w-10 bg-steel/20 rounded"></div>
          </div>
          <div className="h-10 w-3/4 bg-steel/20 rounded-lg"></div>
          
          <div className="space-y-4 pt-4">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-steel/20 shrink-0"></div>
              <div className="h-5 w-2/3 bg-steel/15 rounded"></div>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-steel/20 shrink-0"></div>
              <div className="h-5 w-1/2 bg-steel/15 rounded"></div>
            </div>
          </div>

          <div className="space-y-3 pt-6 border-t border-black/10">
            <div className="h-4 w-1/4 bg-steel/20 rounded"></div>
            <div className="flex gap-2 flex-wrap">
              <div className="h-8 w-24 bg-steel/15 rounded-xl"></div>
              <div className="h-8 w-32 bg-steel/15 rounded-xl"></div>
            </div>
          </div>

          <div className="space-y-3 pt-6 border-t border-black/10">
            <div className="h-4 w-1/4 bg-steel/20 rounded"></div>
            <div className="flex gap-2 flex-wrap">
              <div className="h-8 w-28 bg-steel/15 rounded-xl"></div>
              <div className="h-8 w-20 bg-steel/15 rounded-xl"></div>
            </div>
          </div>
        </div>

        {/* Right side map placeholder */}
        <div className="w-full md:w-1/2 h-64 md:h-auto bg-steel/10 border-t md:border-t-0 md:border-l border-carbon-black/10 flex items-center justify-center min-h-[300px]">
          <div className="h-10 w-32 bg-steel/20 rounded animate-pulse"></div>
        </div>
      </CardWrapper>
    );
  }

  const getNormalizedArray = (data) => {
    if (Array.isArray(data)) return data;
    if (typeof data === 'string') return data.split(/[,;]/).map(s => s.trim()).filter(Boolean);
    if (data && typeof data === 'object') return Object.values(data).filter(v => typeof v === 'string');
    return [];
  };

  const rawFacilities = hospital?.facilities;
  const rawSpecialties = hospital?.specialty || hospital?.specialties;

  const facilities = getNormalizedArray(rawFacilities);
  const specialties = getNormalizedArray(rawSpecialties);

  const hospitalName = hospital?.name || hospital?.display_name || "Hospital";
  const hospitalAddress = hospital?.address || 'Address not available';
  const hospitalDistance = hospital?.distance || 'Calculating...';
  const hospitalPhone = hospital?.phone || null;
  const hospitalType = hospital?.type || 'General';
  const hospitalRating = hospital?.rating || 'N/A';

  const hasPhone = hospitalPhone && hospitalPhone !== 'Phone number not available' && hospitalPhone.replace(/[^0-9+]/g, '').length > 0;
  const isHospitalOpen = hospital?.isOpen ?? (hospital?.emergency ? true : null);

  // Build Google Maps directions URL
  const getMapsUrl = () => {
    if (hospital?.lat && hospital?.lng) {
      return `https://www.google.com/maps/dir/?api=1&destination=${hospital.lat},${hospital.lng}`;
    }
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(hospitalName + ' ' + hospitalAddress)}`;
  };

  return (
    <CardWrapper isOpen={isOpen} onClose={onClose} maxWidth="max-w-5xl">
            {/* Left side: Hospital Details */}
            <div className="p-8 md:p-10 flex-1 overflow-y-auto max-h-[80vh] md:max-h-[90vh] text-carbon-black">
              {/* Type badge & Rating */}
              <div className="flex items-center gap-3 mb-6">
                <span className={`px-4 py-1.5 rounded-xl text-xs font-bold uppercase tracking-widest border-2 ${
                  hospitalType === 'Emergency' ? 'bg-red-50 text-red-600 border-red-300' :
                  hospitalType === 'Cardiology' ? 'bg-blue-50 text-blue-700 border-blue-300' :
                  'bg-mint-wash text-green-700 border-green-300'
                }`}>
                  {hospitalType} Specialist
                </span>
                <div className="flex items-center gap-1 text-amber-spark font-bold">
                  <Star size={16} fill="currentColor" />
                  {hospitalRating}
                </div>
              </div>

              {/* Hospital Name */}
              <h2 className="text-4xl font-bold uppercase tracking-tight mb-6 leading-none text-carbon-black">
                {hospitalName}
              </h2>

              {/* Key Info Grid */}
              <div className="space-y-4 mb-8">
                {/* Address + Distance */}
                <div className="flex items-center gap-4 text-steel font-bold">
                  <div className="w-10 h-10 shrink-0 rounded-xl bg-fog border border-carbon-black/10 flex items-center justify-center text-carbon-black">
                    <MapPin size={20} />
                  </div>
                  <span>{hospitalAddress} • <span className="text-blue-600">{hospitalDistance} {hospitalDistance !== 'Calculating...' ? 'away' : ''}</span></span>
                </div>

                {/* Hours + Travel Time */}
                <div className="flex items-center gap-4 text-steel font-bold">
                  <div className="w-10 h-10 shrink-0 rounded-xl bg-fog border border-carbon-black/10 flex items-center justify-center text-green-600">
                    <Clock size={20} />
                  </div>
                  <span>
                    {isHospitalOpen !== null ? (isHospitalOpen ? 'Open 24/7' : 'Standard Hours') : 'Hours info unavailable'}
                    {hospital?.travelTime_text && ` • ${hospital.travelTime_text}`}
                  </span>
                </div>

                {/* Rating detail */}
                <div className="flex items-center gap-4 text-steel font-bold">
                  <div className="w-10 h-10 shrink-0 rounded-xl bg-fog border border-carbon-black/10 flex items-center justify-center text-amber-spark">
                    <Star size={20} />
                  </div>
                  <span>Rating: <span className="text-carbon-black">{hospitalRating} / 5.0</span> — {hospitalRating >= 4.5 ? 'Excellent' : hospitalRating >= 4.0 ? 'Very Good' : 'Good'}</span>
                </div>

                {/* Phone */}
                <div className="flex items-center gap-4 text-steel font-bold">
                  <div className="w-10 h-10 shrink-0 rounded-xl bg-fog border border-carbon-black/10 flex items-center justify-center text-green-600">
                    <Phone size={20} />
                  </div>
                  <span>{hospitalPhone || 'Phone number unavailable'}</span>
                </div>
              </div>

              {/* Specialties */}
              <div className="mb-8">
                <h4 className="text-xs font-bold uppercase tracking-widest text-steel mb-4 flex items-center gap-2">
                  <Stethoscope size={14} /> Core Specialties
                </h4>
                {specialties.length > 0 && specialties[0] !== 'Specialty information unavailable' ? (
                  <div className="flex flex-wrap gap-2">
                    {specialties.map((s, i) => (
                      <span key={i} className="px-4 py-2 rounded-xl bg-fog border border-carbon-black/15 text-sm font-bold text-carbon-black">
                        {s}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm font-bold text-steel">Specialty information unavailable</p>
                )}
              </div>

              {/* Available Facilities */}
              <div className="mb-8">
                <h4 className="text-xs font-bold uppercase tracking-widest text-steel mb-4 flex items-center gap-2">
                  <Building2 size={14} /> Available Facilities
                </h4>
                {facilities.length > 0 && facilities[0] !== 'Standard Care' ? (
                  <div className="grid grid-cols-2 gap-2">
                    {facilities.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white border border-carbon-black/10 text-sm font-bold text-carbon-black">
                        <div className="w-2 h-2 rounded-full bg-lime-pulse border border-carbon-black/20 shrink-0" />
                        {f}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm font-bold text-steel">Facility information unavailable</p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4">
                {hasPhone ? (
                  <a 
                    href={`tel:${hospitalPhone.replace(/[^0-9+]/g, '')}`}
                    className="flex-1 flex items-center justify-center gap-3 py-5 bg-white text-carbon-black border-2 border-carbon-black font-bold rounded-2xl uppercase tracking-widest hover:bg-fog transition-colors shadow-brutal text-sm"
                  >
                    <Phone size={18} className="text-green-600" /> Call {hospitalPhone}
                  </a>
                ) : (
                  <div className="flex-1 flex items-center justify-center gap-3 py-5 bg-fog text-steel border border-carbon-black/20 font-bold rounded-2xl uppercase tracking-widest cursor-not-allowed text-sm" title="Phone number not available">
                    <Phone size={18} /> Phone Unavailable
                  </div>
                )}

                <a
                  href={getMapsUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-3 py-5 bg-lime-pulse text-carbon-black border-2 border-carbon-black font-bold rounded-2xl uppercase tracking-widest hover:shadow-brutal-dark transition-all shadow-brutal text-sm"
                >
                  <Navigation size={18} className="text-blue-600" /> Open Maps
                </a>
              </div>

              {/* Emergency Indicator */}
              {hospital.emergency && (
                <div className="mt-8 bg-red-50 border-2 border-red-300 rounded-xl px-6 py-4 flex items-center gap-3 shadow-brutal-sm">
                  <ShieldCheck size={18} className="text-red-500" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-red-600">Trauma Level 1 Certified Facility</span>
                </div>
              )}
            </div>

            {/* Right side: Map */}
            <div className="w-full md:w-1/2 h-64 md:h-auto relative bg-fog border-t md:border-t-0 md:border-l border-carbon-black/10">
              {mapBounds ? (
                <MapContainer 
                  key={hospital.name || hospital.id}
                  bounds={mapBounds} 
                  zoomControl={false}
                  className="w-full h-full min-h-[300px] md:min-h-full z-0"
                >
                  <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                    attribution='&copy; OpenStreetMap & CARTO'
                  />
                  <MapRefresher bounds={mapBounds} />
                  
                  <Marker position={mapBounds[0]} icon={userIcon} />
                  <Marker position={mapBounds[1]} icon={hospitalIcon} />
                  
                  <Polyline 
                    positions={mapBounds} 
                    pathOptions={{ color: '#000000', weight: 3, opacity: 0.7, dashArray: '10, 10', lineCap: 'round' }} 
                  />
                  
                  {/* Custom Map Control overlay for distance */}
                  <div className="absolute top-4 left-4 z-[400] bg-white border border-carbon-black px-4 py-2 rounded-xl text-carbon-black font-bold text-xs uppercase tracking-widest shadow-brutal flex items-center gap-2">
                     <Navigation size={14} className="text-blue-600" /> {hospital.distance} Route
                  </div>
                </MapContainer>
              ) : (
                <div className="flex items-center justify-center w-full h-full text-steel font-bold text-sm">
                  Location data unavailable for map.
                </div>
              )}
            </div>
            
          </CardWrapper>
  );
};

export default HospitalModal;
