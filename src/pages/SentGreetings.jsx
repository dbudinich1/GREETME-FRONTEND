// src/pages/SentGreetings.jsx
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import { formatDateTime, getOccasionIcon, getOccasionLabel } from '../utils/helpers';
import { Mail, Calendar, User, Eye, Download, Search, Filter, Clock, CheckCircle, XCircle, AlertCircle, Sparkles } from 'lucide-react';

export default function SentGreetings() {
  const { user } = useAuth();
  const [greetings, setGreetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedGreeting, setSelectedGreeting] = useState(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    fetchSentGreetings();
  }, []);

  const fetchSentGreetings = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.getSentGreetings();

      if (response.data?.greetings) {
        setGreetings(response.data.greetings);
      }
    } catch (err) {
      console.error('Error fetching sent greetings:', err);
      setError("We couldn't load your sent messages right now. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const viewGreeting = (greeting) => {
    setSelectedGreeting(greeting);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedGreeting(null);
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      completed: {
        icon: CheckCircle,
        text: 'Sent',
        className: 'bg-green-100 text-green-700 border-green-200'
      },
      pending: {
        icon: Clock,
        text: 'Creating',
        className: 'bg-yellow-100 text-yellow-700 border-yellow-200'
      },
      failed: {
        icon: XCircle,
        text: 'Not sent',
        className: 'bg-gray-100 text-gray-700 border-gray-200'
      },
    };

    const config = statusConfig[status] || statusConfig.pending;
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-semibold border ${config.className}`}>
        <Icon size={14} />
        <span>{config.text}</span>
      </span>
    );
  };

  const filteredGreetings = greetings.filter((greeting) => {
    const matchesSearch =
      greeting.recipientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      greeting.recipientEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      greeting.occasionType?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || greeting.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your sent Greet-Me messages...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center space-x-3 mb-2">
          <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-pink-500 rounded-xl flex items-center justify-center shadow-lg">
            <Mail className="text-white" size={24} />
          </div>
          <div>
            <h1 className="text-3xl font-bold gradient-text">Sent</h1>
            <p className="text-gray-600">View and manage all your past Greet-Me sends</p>
          </div>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div className="card mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search Input */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search by recipient name, email, or occasion..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
            />
          </div>

          {/* Status Filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="pl-10 pr-8 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all appearance-none bg-white"
            >
              <option value="all">All Status</option>
              <option value="completed">Sent</option>
              <option value="pending">Creating</option>
              <option value="failed">Not sent</option>
            </select>
          </div>
        </div>

        {/* Results Count */}
        <div className="mt-4 text-sm text-gray-600">
          Showing <span className="font-semibold text-purple-600">{filteredGreetings.length}</span> of{' '}
          <span className="font-semibold">{greetings.length}</span> sends
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border-2 border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6 flex items-center space-x-2">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {/* Greetings List */}
      {filteredGreetings.length === 0 ? (
        <div className="card text-center py-12">
          <div className="w-20 h-20 bg-gradient-to-br from-purple-100 to-pink-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Mail className="text-purple-600" size={40} />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No Greet-Me Sends Found</h3>
          <p className="text-gray-600 mb-6">
            {searchTerm || statusFilter !== 'all'
              ? "Try adjusting your search or filters"
              : "You haven't sent any Greet-Me messages yet"}
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredGreetings.map((greeting) => (
            <div
              key={greeting.id}
              className="card hover:shadow-xl transition-all duration-300 cursor-pointer"
              onClick={() => viewGreeting(greeting)}
            >
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                {/* Left Side - Recipient Info */}
                <div className="flex items-start space-x-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center text-white text-2xl flex-shrink-0">
                    {getOccasionIcon(greeting.occasionType)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
                      <User size={16} className="text-gray-400" />
                      <span className="truncate">{greeting.recipientName}</span>
                    </h3>
                    <p className="text-sm text-gray-600 flex items-center space-x-2 mt-1">
                      <Mail size={14} className="text-gray-400" />
                      <span className="truncate">{greeting.recipientEmail}</span>
                    </p>
                    <div className="flex items-center space-x-4 mt-2">
                      <span className="inline-flex items-center space-x-1 text-xs text-gray-500">
                        <Calendar size={14} />
                        <span>{getOccasionLabel(greeting.occasionType)}</span>
                      </span>
                      <span className="inline-flex items-center space-x-1 text-xs text-gray-500">
                        <Clock size={14} />
                        <span>{formatDateTime(greeting.createdAt)}</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right Side - Status and Actions */}
                <div className="flex items-center space-x-3 md:flex-shrink-0">
                  {getStatusBadge(greeting.status)}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      viewGreeting(greeting);
                    }}
                    className="btn-secondary px-4 py-2 flex items-center space-x-2"
                  >
                    <Eye size={16} />
                    <span>View</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal for Viewing Greeting Details */}
      {showModal && selectedGreeting && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-pink-500 text-white px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <div className="flex items-center space-x-3">
                <div className="text-3xl">{getOccasionIcon(selectedGreeting.occasionType)}</div>
                <div>
                  <h2 className="text-xl font-bold">{selectedGreeting.recipientName}</h2>
                  <p className="text-white text-opacity-90 text-sm">{getOccasionLabel(selectedGreeting.occasionType)}</p>
                </div>
              </div>
              <button
                onClick={closeModal}
                className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-2 transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Status */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Status</label>
                {getStatusBadge(selectedGreeting.status)}
              </div>

              {/* Recipient Details */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Recipient Name</label>
                  <p className="text-gray-900">{selectedGreeting.recipientName}</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Email Address</label>
                  <p className="text-gray-900">{selectedGreeting.recipientEmail}</p>
                </div>
              </div>

              {/* Occasion & Date */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Occasion</label>
                  <p className="text-gray-900 flex items-center space-x-2">
                    <span>{getOccasionIcon(selectedGreeting.occasionType)}</span>
                    <span>{getOccasionLabel(selectedGreeting.occasionType)}</span>
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Sent On</label>
                  <p className="text-gray-900">{formatDateTime(selectedGreeting.createdAt)}</p>
                </div>
              </div>

              {/* Personal Message (if available) */}
              {selectedGreeting.personalSentiment && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Personal Message</label>
                  <p className="text-gray-900 bg-gray-50 rounded-xl p-4 border border-gray-200">
                    {selectedGreeting.personalSentiment}
                  </p>
                </div>
              )}

              {/* Video Preview (if available) */}
              {selectedGreeting.videoUrl && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Video</label>
                  <div className="relative rounded-xl overflow-hidden bg-black">
                    <video
                      src={selectedGreeting.videoUrl}
                      controls
                      className="w-full"
                      poster={selectedGreeting.photoUrl}
                    >
                      Your browser does not support the video tag.
                    </video>
                  </div>
                </div>
              )}

              {/* Download Button (if video available) */}
              {selectedGreeting.videoUrl && (
                <div className="flex justify-end space-x-3">
                  <a
                    href={selectedGreeting.videoUrl}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary px-6 py-3 flex items-center space-x-2"
                  >
                    <Download size={18} />
                    <span>Download Video</span>
                  </a>
                </div>
              )}

              {/* What happened (if failed) */}
              {selectedGreeting.status === 'failed' && (
                <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-4">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">What happened</label>
                  <p className="text-gray-600 text-sm">We couldn't send this Greet-Me. Please try again.</p>
                </div>
              )}
            </div>

            <div className="sticky bottom-0 bg-gray-50 px-6 py-4 flex justify-end space-x-3 rounded-b-2xl border-t border-gray-200">
              <button
                onClick={closeModal}
                className="btn-secondary px-6 py-3"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
