'use client';

/**
 * MediRoute India — Patient Medical Hotels Portal
 * Agoda-style hotel booking portal for international patients: search, city filter, amenity tags, hotel cards, and stay reservations.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { DatePicker } from '@/components/ui/DatePicker';
import { Select } from '@/components/ui/Select';
import { toast } from '@/components/ui/Toast';
import {
  Building2,
  Calendar,
  MapPin,
  ShieldCheck,
  PlusCircle,
  Star,
  Search,
  ArrowRight,
} from 'lucide-react';

enum RoomType {
  SINGLE = 'SINGLE',
  DOUBLE = 'DOUBLE',
  SUITE = 'SUITE',
  DORMITORY = 'DORMITORY',
}

interface Hostel {
  id: string;
  name: string;
  city: string;
  address: string;
  description?: string | null;
  capacity: number;
  pricingPerNight: number;
  roomTypes: string[];
  amenities?: string[] | null;
  images?: string[] | null;
  distanceToHospital?: string | null;
  rating?: number | null;
  contactPhone?: string | null;
  rules?: string | null;
  isActive: boolean;
}

interface Booking {
  id: string;
  caseId: string;
  hostelId: string;
  checkIn: string;
  checkOut: string;
  roomType: RoomType;
  status: 'PENDING' | 'CONFIRMED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED';
  hostel: Hostel;
}

export default function PatientAccommodationsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [cityFilter, setCityFilter] = useState('ALL');
  const [amenityFilter, setAmenityFilter] = useState('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedHostelId, setSelectedHostelId] = useState('');
  const [selectedCaseId, setSelectedCaseId] = useState('');
  const [selectedRoomType, setSelectedRoomType] = useState<RoomType>(RoomType.SINGLE);
  const [checkInDate, setCheckInDate] = useState('');
  const [checkOutDate, setCheckOutDate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchAccommodations = useCallback(async () => {
    await Promise.resolve();
    try {
      const res = await fetch('/api/v1/patient/accommodations');
      const data = await res.json();

      if (data.success) {
        setBookings(data.data.bookings || []);
        setHostels(data.data.hostels || []);

        if (data.data.cases?.length > 0) {
          setSelectedCaseId(data.data.cases[0].id);
        }
      } else {
        toast.error(data.error?.message || 'Failed to load hotel options');
      }
    } catch (err) {
      console.error('Failed to load patient accommodations:', err);
      toast.error('Network error loading hotels');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      fetchAccommodations();
    });
  }, [fetchAccommodations]);

  const uniqueCities = useMemo(() => {
    const set = new Set<string>();
    hostels.forEach((h) => set.add(h.city));
    return Array.from(set);
  }, [hostels]);

  const filteredHostels = useMemo(() => {
    return hostels.filter((h) => {
      const matchesSearch =
        h.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        h.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
        h.address.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCity = cityFilter === 'ALL' || h.city.toLowerCase() === cityFilter.toLowerCase();

      const matchesAmenity =
        amenityFilter === 'ALL' ||
        (Array.isArray(h.amenities) && h.amenities.some((a) => a.toLowerCase().includes(amenityFilter.toLowerCase())));

      return matchesSearch && matchesCity && matchesAmenity;
    });
  }, [hostels, searchQuery, cityFilter, amenityFilter]);

  const handleOpenBookModal = (hostelId?: string) => {
    if (hostelId) {
      setSelectedHostelId(hostelId);
    } else if (hostels.length > 0) {
      setSelectedHostelId(hostels[0].id);
    }
    setIsModalOpen(true);
  };

  const handleBookSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedCaseId) {
      toast.error('You must have an active care case to book accommodation.');
      return;
    }

    if (!selectedHostelId || !checkInDate || !checkOutDate) {
      toast.error('Please select check-in date, check-out date, and hotel property.');
      return;
    }

    if (new Date(checkOutDate) <= new Date(checkInDate)) {
      toast.error('Check-out date must be after check-in date.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/v1/patient/accommodations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseId: selectedCaseId,
          hostelId: selectedHostelId,
          checkIn: checkInDate,
          checkOut: checkOutDate,
          roomType: selectedRoomType,
        }),
      });

      const data = await res.json();

      if (data.success) {
        toast.success('Hotel stay request submitted! Your case coordinator will confirm your room.');
        setIsModalOpen(false);
        setCheckInDate('');
        setCheckOutDate('');
        fetchAccommodations();
      } else {
        toast.error(data.error?.message || 'Failed to submit stay request');
      }
    } catch (err) {
      console.error('Submit booking failed:', err);
      toast.error('Failed to register stay request');
    } finally {
      setSubmitting(false);
    }
  };

  const calculateNights = (inDate: string, outDate: string) => {
    if (!inDate || !outDate) return 0;
    const diff = new Date(outDate).getTime() - new Date(inDate).getTime();
    const nights = Math.ceil(diff / (1000 * 3600 * 24));
    return nights > 0 ? nights : 0;
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
        return 'success';
      case 'CHECKED_IN':
        return 'primary';
      case 'CHECKED_OUT':
        return 'default';
      case 'CANCELLED':
        return 'danger';
      case 'PENDING':
      default:
        return 'warning';
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <div className="w-10 h-10 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-medium text-surface-700">Loading verified medical hotels...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 animate-fade-in text-xs">
      {/* Hero Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-gradient-to-r from-teal-900 via-primary-900 to-primary-950 p-6 sm:p-8 rounded-3xl text-white shadow-md relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-teal-500/20 blur-3xl pointer-events-none" />

        <div className="space-y-2 max-w-2xl relative z-10">
          <div className="inline-flex items-center gap-2 bg-teal-800/80 border border-teal-700/60 px-3 py-1 rounded-full text-xs font-semibold text-teal-200">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Verified Medical Hotel Partners & Recovery Inns</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Agoda-Style Medical Hotels Portal
          </h1>
          <p className="text-sm text-teal-100/90 leading-relaxed">
            Reserve comfortable, hospital-adjacent medical hotels tailored for post-operative recovery, attendant stay, and therapy timelines in India.
          </p>
        </div>

        <div className="relative z-10 shrink-0">
          <Button size="lg" onClick={() => handleOpenBookModal()} className="bg-white text-primary-950 hover:bg-teal-50 shadow-sm font-bold">
            <PlusCircle className="w-4 h-4 mr-2" /> Request Hotel Stay
          </Button>
        </div>
      </div>

      {/* Agoda-style Filter & Search Bar */}
      <Card className="p-4 rounded-2xl border border-surface-200 shadow-xs bg-white space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-surface-400 absolute left-3.5 top-3 pointer-events-none" />
            <input
              type="text"
              placeholder="Search hotels by property name, city, or medical center..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-surface-50 border border-surface-300 rounded-xl text-xs text-surface-900 focus:outline-none focus:border-primary-600 focus:bg-white"
            />
          </div>

          <div className="flex gap-2">
            <select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="px-3.5 py-2.5 bg-surface-50 border border-surface-300 rounded-xl text-xs font-semibold text-surface-800 focus:outline-none focus:border-primary-600"
            >
              <option value="ALL">All Cities</option>
              {uniqueCities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>

            <select
              value={amenityFilter}
              onChange={(e) => setAmenityFilter(e.target.value)}
              className="px-3.5 py-2.5 bg-surface-50 border border-surface-300 rounded-xl text-xs font-semibold text-surface-800 focus:outline-none focus:border-primary-600"
            >
              <option value="ALL">All Medical Features</option>
              <option value="Nursing">24/7 Nursing</option>
              <option value="Wheelchair">Wheelchair Access</option>
              <option value="Shuttle">Hospital Shuttle</option>
              <option value="Oxygen">Oxygen Support</option>
            </select>
          </div>
        </div>
      </Card>

      {/* My Accommodation Bookings */}
      {bookings.length > 0 && (
        <Card className="p-6 rounded-2xl shadow-xs border border-surface-200 space-y-4 bg-white">
          <div className="border-b border-surface-100 pb-3 flex items-center justify-between">
            <h2 className="text-base font-bold text-surface-900 tracking-tight flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary-600" /> My Reserved Hotel Stays
            </h2>
            <Badge variant="primary" dot>Active Stay Records</Badge>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-surface-50 border-b border-surface-200/80">
                  <th className="px-4 py-3 font-bold text-surface-800">Hotel Property</th>
                  <th className="px-4 py-3 font-bold text-surface-800">Location</th>
                  <th className="px-4 py-3 font-bold text-surface-800">Room Type</th>
                  <th className="px-4 py-3 font-bold text-surface-800">Dates</th>
                  <th className="px-4 py-3 font-bold text-surface-800">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-200/60">
                {bookings.map((booking) => {
                  const nights = calculateNights(booking.checkIn, booking.checkOut);
                  return (
                    <tr key={booking.id} className="hover:bg-surface-50/60">
                      <td className="px-4 py-3">
                        <Link href={`/patient/accommodations/${booking.hostelId}`} className="font-bold text-primary-700 hover:underline">
                          {booking.hostel.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-xs text-surface-700">{booking.hostel.city}</td>
                      <td className="px-4 py-3 font-semibold text-surface-800">{booking.roomType}</td>
                      <td className="px-4 py-3 text-xs text-surface-700">
                        {new Date(booking.checkIn).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} -{' '}
                        {new Date(booking.checkOut).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} ({nights} nights)
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={getStatusBadgeVariant(booking.status)} dot>
                          {booking.status === 'PENDING' ? 'Pending Review' : booking.status}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Agoda-style Hotel Property Cards Grid */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-lg font-bold text-surface-900 tracking-tight">Browse Medical Hotels</h2>
            <p className="text-xs text-surface-600">Explore partner hotels featuring medical support and close proximity to top hospitals.</p>
          </div>
          <span className="text-xs font-bold text-surface-500">{filteredHostels.length} Properties Available</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredHostels.map((hostel) => {
            const firstImg = Array.isArray(hostel.images) && hostel.images.length > 0
              ? hostel.images[0]
              : 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80';

            const amenitiesList = Array.isArray(hostel.amenities) && hostel.amenities.length > 0
              ? hostel.amenities
              : ['24/7 Nursing', 'Wheelchair Access', 'Hospital Shuttle'];

            return (
              <Card
                key={hostel.id}
                className="p-0 rounded-3xl border border-surface-200 bg-white overflow-hidden shadow-xs hover:shadow-lg transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Photo Gallery Thumbnail */}
                  <div className="h-48 bg-surface-100 relative overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={firstImg} alt={hostel.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    <div className="absolute top-3 right-3 bg-surface-900/80 backdrop-blur-xs text-white px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" /> {hostel.rating || 4.8}
                    </div>
                    <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-xs text-surface-900 px-3 py-1 rounded-full text-[11px] font-bold shadow-xs">
                      {hostel.city}
                    </div>
                  </div>

                  {/* Card Content */}
                  <div className="p-5 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-bold text-surface-900 text-base line-clamp-1">{hostel.name}</h3>
                        <p className="text-xs font-semibold text-primary-700 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3.5 h-3.5 text-primary-600 shrink-0" /> {hostel.distanceToHospital || 'Near Partner Hospital'}
                        </p>
                      </div>
                    </div>

                    <p className="text-xs text-surface-600 line-clamp-2 leading-relaxed">
                      {hostel.description || 'Verified post-operative recuperation hotel equipped with 24/7 care support and medical dietary catering.'}
                    </p>

                    <div className="flex flex-wrap gap-1 pt-1">
                      {amenitiesList.slice(0, 3).map((amenity) => (
                        <span key={amenity} className="px-2 py-0.5 bg-surface-100 text-surface-700 rounded-md text-[11px] font-semibold border border-surface-200">
                          {amenity}
                        </span>
                      ))}
                      {amenitiesList.length > 3 && (
                        <span className="px-2 py-0.5 bg-surface-100 text-surface-500 rounded-md text-[11px] font-semibold">
                          +{amenitiesList.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Card Footer */}
                <div className="p-5 border-t border-surface-100 bg-surface-50/50 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-surface-500 uppercase font-semibold block">Starting from</span>
                    <span className="text-lg font-extrabold text-surface-900">₹{Number(hostel.pricingPerNight).toLocaleString()}</span>
                    <span className="text-xs text-surface-500"> / night</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Link href={`/patient/accommodations/${hostel.id}`}>
                      <Button size="sm" variant="secondary" className="font-bold">
                        View Details <ArrowRight className="w-3.5 h-3.5 ml-1" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Book Lodging Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-surface-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <Card className="bg-white max-w-lg w-full p-6 space-y-5 border border-surface-200 shadow-xl rounded-3xl animate-scale-in">
            <div className="flex justify-between items-center pb-3 border-b border-surface-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center font-bold">
                  <Building2 className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-surface-900 text-lg">Request Hotel Accommodation</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-surface-400 hover:text-surface-600 font-semibold text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleBookSubmit} className="space-y-4">
              <Select
                label="Target Hotel Property"
                value={selectedHostelId}
                onChange={setSelectedHostelId}
                options={hostels.map((h) => ({
                  value: h.id,
                  label: `${h.name} (${h.city}) — ₹${h.pricingPerNight}/night`,
                }))}
                required
              />

              <Select
                label="Room Category Option"
                value={selectedRoomType}
                onChange={(val) => setSelectedRoomType(val as RoomType)}
                options={[
                  { value: RoomType.SINGLE, label: 'Single Private Room' },
                  { value: RoomType.DOUBLE, label: 'Double Family Room' },
                  { value: RoomType.SUITE, label: 'Full Executive Suite' },
                  { value: RoomType.DORMITORY, label: 'Shared Recovery Ward' },
                ]}
                required
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <DatePicker
                  label="Check-In Date"
                  value={checkInDate}
                  onChange={setCheckInDate}
                  placeholder="Select check-in"
                />
                <DatePicker
                  label="Check-Out Date"
                  value={checkOutDate}
                  onChange={setCheckOutDate}
                  placeholder="Select check-out"
                />
              </div>

              {checkInDate && checkOutDate && new Date(checkOutDate) > new Date(checkInDate) && (
                <div className="p-3 bg-primary-50 border border-primary-200/80 rounded-xl text-xs flex justify-between items-center text-primary-900 font-semibold">
                  <span>Length of Stay:</span>
                  <span className="font-extrabold text-sm">{calculateNights(checkInDate, checkOutDate)} Nights</span>
                </div>
              )}

              <div className="pt-3 border-t border-surface-100 flex gap-3">
                <Button type="button" variant="secondary" className="flex-1" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" isLoading={submitting}>
                  Submit Stay Request
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
