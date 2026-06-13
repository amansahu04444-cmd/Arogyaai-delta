const { logger } = require('../utils/logger');

const MOCK_HOSPITALS = [
  {
    id: 'h001',
    name: 'Apollo Emergency Hospital',
    address: '123 Medical Road, Connaught Place, New Delhi',
    phone: '+91-11-2345-6789',
    distance: '2.3 km',
    emergency: true,
    beds: { total: 50, available: 12 },
    specialties: ['Cardiac', 'Neurology', 'Emergency', 'Trauma'],
    rating: 4.8
  },
  {
    id: 'h002',
    name: 'Max Healthcare Center',
    address: '456 Health Avenue, Saket, New Delhi',
    phone: '+91-11-3456-7890',
    distance: '4.1 km',
    emergency: true,
    beds: { total: 100, available: 28 },
    specialties: ['General', 'Orthopedics', 'Pediatrics', 'Emergency'],
    rating: 4.6
  },
  {
    id: 'h003',
    name: 'Fortis Emergency Care',
    address: '789 Hospital Lane, Gurgaon',
    phone: '+91-124-6789-012',
    distance: '5.8 km',
    emergency: true,
    beds: { total: 75, available: 15 },
    specialties: ['Cardiac', 'Emergency', 'Critical Care'],
    rating: 4.7
  },
  {
    id: 'h004',
    name: 'Medanta Medicity',
    address: '321 Care Boulevard, Gurgaon',
    phone: '+91-124-7890-123',
    distance: '7.2 km',
    emergency: true,
    beds: { total: 200, available: 45 },
    specialties: ['Multi-specialty', 'Emergency', 'Transplant', 'Cardiac'],
    rating: 4.9
  },
  {
    id: 'h005',
    name: 'ArogyaAI Clinic Network',
    address: 'Near Metro Station, Sector 22, Noida',
    phone: '+91-120-4567-890',
    distance: '1.2 km',
    emergency: false,
    beds: { total: 20, available: 8 },
    specialties: ['General', 'Dental', 'Eye Care'],
    rating: 4.3
  }
];

async function findNearestHospital(location) {
  logger.info('Finding nearest hospital', { location });

  await simulateLatency(100);

  const emergencyHospitals = MOCK_HOSPITALS.filter(h => h.emergency);

  return {
    success: true,
    data: {
      nearest: emergencyHospitals[0],
      all: MOCK_HOSPITALS,
      emergency_count: emergencyHospitals.length,
      search_radius: '10 km'
    }
  };
}

async function findHospitalsBySpecialty(specialty) {
  logger.info('Finding hospitals by specialty', { specialty });

  await simulateLatency(150);

  const matching = MOCK_HOSPITALS.filter(h =>
    h.specialties.some(s => s.toLowerCase().includes(specialty.toLowerCase()))
  );

  return {
    success: true,
    data: {
      hospitals: matching,
      count: matching.length
    }
  };
}

async function checkBedAvailability(hospitalId) {
  logger.info('Checking bed availability', { hospitalId });

  await simulateLatency(80);

  const hospital = MOCK_HOSPITALS.find(h => h.id === hospitalId);

  if (!hospital) {
    return {
      success: false,
      error: 'Hospital not found'
    };
  }

  return {
    success: true,
    data: {
      hospital_id: hospitalId,
      hospital_name: hospital.name,
      beds: hospital.beds,
      available: hospital.beds.available > 0
    }
  };
}

async function getHospitalDetails(hospitalId) {
  logger.info('Getting hospital details', { hospitalId });

  const hospital = MOCK_HOSPITALS.find(h => h.id === hospitalId);

  if (!hospital) {
    return {
      success: false,
      error: 'Hospital not found'
    };
  }

  return {
    success: true,
    data: hospital
  };
}

function simulateLatency(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  findNearestHospital,
  findHospitalsBySpecialty,
  checkBedAvailability,
  getHospitalDetails,
  MOCK_HOSPITALS
};
