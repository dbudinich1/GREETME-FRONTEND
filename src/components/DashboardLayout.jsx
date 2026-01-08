// src/components/DashboardLayout.jsx
import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Home, Users, Send, Image, Settings, LogOut, Menu, X, Sparkles, ChevronDown, Mail } from 'lucide-react';

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navigation = [
    { name: 'Dashboard', path: '/dashboard', icon: Home },
    { name: 'Contacts', path: '/dashboard/contacts', icon: Users },
    { name: 'Send Greeting', path: '/dashboard/send', icon: Send },
    { name: 'Sent Greetings', path: '/dashboard/sent', icon: Mail },
    { name: 'Media Library', path: '/dashboard/profile', icon: Image },
    { name: 'Settings', path: '/dashboard/settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation Bar */}
      <nav className="bg-white shadow-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            {/* Logo and Brand */}
            <div className="flex items-center">
              <div className="flex-shrink-0 flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-pink-500 rounded-xl flex items-center justify-center shadow-lg">
                  <Sparkles className="text-white" size={20} />
                </div>
                <div className="hidden sm:block">
                  <h1 className="text-xl font-bold gradient-text">Greet-Me</h1>
                  <p className="text-xs text-gray-500">AI-Powered Greetings</p>
                </div>
              </div>

              {/* Desktop Navigation */}
              <div className="hidden lg:ml-10 lg:flex lg:space-x-1">
                {navigation.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) =>
                      `group flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        isActive
                          ? 'bg-gradient-to-r from-purple-50 to-pink-50 text-purple-600'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <item.icon
                          size={18}
                          className={`${
                            isActive ? 'text-purple-600' : 'text-gray-500 group-hover:text-gray-700'
                          } transition-colors`}
                        />
                        <span>{item.name}</span>
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>

            {/* Right Side - User Menu */}
            <div className="flex items-center space-x-4">
              {/* Status Badge */}
              <div className="hidden md:flex items-center space-x-2 bg-gradient-to-r from-green-50 to-emerald-50 px-3 py-1 rounded-full">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-xs font-medium text-green-700">Active</span>
              </div>

              {/* User Menu - Desktop */}
              <div className="hidden lg:block relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center space-x-3 bg-gradient-to-r from-purple-50 to-pink-50 px-4 py-2 rounded-xl hover:shadow-md transition-all"
                >
                  <div className="w-8 h-8 bg-gradient-to-br from-yellow-400 to-pink-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                    {user?.name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-gray-900">{user?.name || 'User'}</p>
                    <p className="text-xs text-gray-500">View profile</p>
                  </div>
                  <ChevronDown size={16} className="text-gray-500" />
                </button>

                {/* Dropdown Menu */}
                {userMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setUserMenuOpen(false)}
                    ></div>
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-200 py-2 z-20">
                      <div className="px-4 py-3 border-b border-gray-100">
                        <p className="text-sm font-semibold text-gray-900">{user?.name || 'User'}</p>
                        <p className="text-xs text-gray-500 truncate">{user?.email || 'user@example.com'}</p>
                      </div>
                      <button
                        onClick={handleLogout}
                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2"
                      >
                        <LogOut size={16} />
                        <span>Logout</span>
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Mobile Menu Button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-gray-200 bg-white">
            <div className="px-4 pt-2 pb-3 space-y-1">
              {navigation.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-gradient-to-r from-purple-50 to-pink-50 text-purple-600'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <item.icon size={20} className={isActive ? 'text-purple-600' : 'text-gray-500'} />
                      <span>{item.name}</span>
                    </>
                  )}
                </NavLink>
              ))}
              <div className="pt-4 border-t border-gray-200 mt-4">
                <div className="flex items-center space-x-3 px-4 py-2">
                  <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-pink-500 rounded-full flex items-center justify-center text-white font-bold">
                    {user?.name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{user?.name || 'User'}</p>
                    <p className="text-xs text-gray-500">{user?.email || 'user@example.com'}</p>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2 mt-2"
                >
                  <LogOut size={18} />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-fade-in">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
