import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../api/client';
import { Attendance, AppNotification } from '../../types';
import {
  LogOut,
  Clock,
  CheckCircle,
  KeyRound,
  PhoneCall,
  Bell,
  ChevronDown,
  CalendarDays,
  Receipt,
  ShieldAlert,
  CheckCheck,
} from 'lucide-react';
import { Modal } from '../common/Modal';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const [time, setTime] = useState<string>('');
  const [todayAttendance, setTodayAttendance] = useState<Attendance | null>(null);
  const [loadingPunch, setLoadingPunch] = useState<boolean>(false);
  const [punchMsg, setPunchMsg] = useState<string | null>(null);

  // Dropdown States
  const [showUserMenu, setShowUserMenu] = useState<boolean>(false);
  const [showNotifMenu, setShowNotifMenu] = useState<boolean>(false);

  // Notifications State
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  // Change Password Modal
  const [showPasswordModal, setShowPasswordModal] = useState<boolean>(false);
  const [oldPassword, setOldPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [passwordMsg, setPasswordMsg] = useState<{ text: string; error: boolean } | null>(null);
  const [isSubmittingPassword, setIsSubmittingPassword] = useState<boolean>(false);

  // My Profile Modal
  const [showProfileModal, setShowProfileModal] = useState<boolean>(false);
  const [phone, setPhone] = useState<string>('');
  const [emergencyName, setEmergencyName] = useState<string>('');
  const [emergencyPhone, setEmergencyPhone] = useState<string>('');
  const [profileMsg, setProfileMsg] = useState<{ text: string; error: boolean } | null>(null);
  const [isSubmittingProfile, setIsSubmittingProfile] = useState<boolean>(false);

  const notifRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const update = () => setTime(new Date().toLocaleTimeString());
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch Attendance
  const fetchAttendance = async () => {
    try {
      const data = await api.getTodayAttendance();
      setTodayAttendance(data);
    } catch (err) {
      console.error('Failed to get attendance status', err);
    }
  };

  // Fetch Notifications
  const fetchNotifications = async () => {
    if (!user) return;
    try {
      const data = await api.getNotifications();
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch (err) {
      console.error('Failed to fetch notifications', err);
    }
  };

  useEffect(() => {
    if (user) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 30000); // 30s background poll
      return () => clearInterval(interval);
    }
  }, [user]);

  useEffect(() => {
    if (user?.employeeId) {
      fetchAttendance();
    }
  }, [user]);

  // Click outside listener for dropdowns
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifMenu(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleQuickClockIn = async () => {
    setLoadingPunch(true);
    setPunchMsg(null);
    try {
      const result = await api.clockIn('ON_SITE');
      setTodayAttendance(result);
      setPunchMsg('Successfully Clocked In!');
      setTimeout(() => setPunchMsg(null), 3000);
    } catch (err: unknown) {
      setPunchMsg(err instanceof Error ? err.message : 'Punch failed.');
    } finally {
      setLoadingPunch(false);
    }
  };

  const handleQuickClockOut = async () => {
    setLoadingPunch(true);
    setPunchMsg(null);
    try {
      const result = await api.clockOut();
      setTodayAttendance(result);
      setPunchMsg('Successfully Clocked Out!');
      setTimeout(() => setPunchMsg(null), 3000);
    } catch (err: unknown) {
      setPunchMsg(err instanceof Error ? err.message : 'Punch failed.');
    } finally {
      setLoadingPunch(false);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all as read', err);
    }
  };

  const handleNotificationClick = async (notif: AppNotification) => {
    if (notif.is_read === 0) {
      try {
        await api.markNotificationRead(notif.id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, is_read: 1 } : n))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch (err) {
        console.error(err);
      }
    }
  };

  const openProfileModal = async () => {
    setShowUserMenu(false);
    setProfileMsg(null);
    setShowProfileModal(true);
    try {
      const profile = await api.getMyProfile();
      setPhone(profile.phone || '');
      setEmergencyName(profile.emergency_contact_name || '');
      setEmergencyPhone(profile.emergency_contact_phone || '');
    } catch (err) {
      console.error('Failed to fetch personal profile details', err);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg(null);

    if (newPassword !== confirmPassword) {
      setPasswordMsg({ text: 'New passwords do not match.', error: true });
      return;
    }

    if (newPassword.length < 8) {
      setPasswordMsg({ text: 'Password must be at least 8 characters long.', error: true });
      return;
    }

    setIsSubmittingPassword(true);
    try {
      await api.changePassword(oldPassword, newPassword);
      setPasswordMsg({ text: 'Password updated successfully!', error: false });
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setShowPasswordModal(false);
        setPasswordMsg(null);
      }, 1500);
    } catch (err: unknown) {
      setPasswordMsg({
        text: err instanceof Error ? err.message : 'Failed to change password.',
        error: true,
      });
    } finally {
      setIsSubmittingPassword(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMsg(null);
    setIsSubmittingProfile(true);

    try {
      await api.updateMyProfile({
        phone,
        emergencyContactName: emergencyName,
        emergencyContactPhone: emergencyPhone,
      });
      setProfileMsg({ text: 'Contact info updated successfully!', error: false });
      setTimeout(() => {
        setShowProfileModal(false);
        setProfileMsg(null);
      }, 1500);
    } catch (err: unknown) {
      setProfileMsg({
        text: err instanceof Error ? err.message : 'Failed to update personal details.',
        error: true,
      });
    } finally {
      setIsSubmittingProfile(false);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN': return 'bg-[#0c0c0d] text-white border-white/20 font-mono text-[10px] uppercase tracking-wider';
      case 'HR_MANAGER': return 'bg-[#ff5a1f]/10 text-[#ff5a1f] border-[#ff5a1f]/30 font-mono text-[10px] uppercase tracking-wider';
      case 'LINE_MANAGER': return 'bg-amber-50 text-amber-800 border-amber-300 font-mono text-[10px] uppercase tracking-wider';
      default: return 'bg-slate-100 text-slate-800 border-slate-200 font-mono text-[10px] uppercase tracking-wider';
    }
  };

  const getNotifIcon = (type: string) => {
    switch (type) {
      case 'LEAVE':
        return <CalendarDays className="w-4 h-4 text-indigo-500" />;
      case 'PAYROLL':
        return <Receipt className="w-4 h-4 text-emerald-500" />;
      case 'ATTENDANCE':
        return <Clock className="w-4 h-4 text-amber-500" />;
      default:
        return <ShieldAlert className="w-4 h-4 text-purple-500" />;
    }
  };

  return (
    <>
      <header className="h-16 bg-[#f4f4f2]/95 backdrop-blur-md border-b border-[#0c0c0d]/10 px-6 flex items-center justify-between sticky top-0 z-30 shadow-sm">
        {/* Left: Brand & Local Clock */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-[7px_2px_7px_2px] -rotate-3 bg-[#0c0c0d] border border-white/20 flex items-center justify-center text-white font-black text-sm shadow-sm">
              N
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="font-extrabold text-xl tracking-[-0.04em] text-[#0c0c0d]">
                NEXUS
              </span>
              <span className="font-mono text-[9px] font-bold tracking-widest uppercase bg-[#ff5a1f]/10 text-[#ff5a1f] px-1.5 py-0.5 rounded border border-[#ff5a1f]/30">
                HRMS®
              </span>
            </div>
          </div>

          <div className="hidden lg:flex items-center space-x-2 text-xs text-[#626368] bg-[#0c0c0d]/5 px-3 py-1 rounded-full border border-[#0c0c0d]/10 font-mono">
            <Clock className="w-3.5 h-3.5 text-[#ff5a1f]" />
            <span className="font-medium text-[#0c0c0d]">{time}</span>
            <span className="text-slate-300">|</span>
            <span className="text-[11px] uppercase tracking-wider">Colombo (GMT+5:30)</span>
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex items-center space-x-3">
          {/* Quick Punch Control */}
          {user?.employeeId && (
            <div className="hidden sm:flex items-center space-x-2">
              {!todayAttendance ? (
                <button
                  onClick={handleQuickClockIn}
                  disabled={loadingPunch}
                  className="inline-flex items-center space-x-1.5 bg-[#ff5a1f] hover:bg-[#eb3e00] text-white font-mono text-xs uppercase tracking-wider px-3.5 py-1.5 rounded-full shadow-sm shadow-[#ff5a1f]/20 transition hover:-translate-y-0.5 disabled:opacity-50"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>Clock In</span>
                </button>
              ) : !todayAttendance.clock_out_time ? (
                <button
                  onClick={handleQuickClockOut}
                  disabled={loadingPunch}
                  className="inline-flex items-center space-x-1.5 bg-[#0c0c0d] hover:bg-neutral-800 text-white font-mono text-xs uppercase tracking-wider px-3.5 py-1.5 rounded-full shadow-sm transition hover:-translate-y-0.5 disabled:opacity-50"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Clock Out</span>
                </button>
              ) : (
                <span className="font-mono text-[11px] uppercase tracking-wider text-slate-500 bg-[#0c0c0d]/5 px-3 py-1 rounded-full border border-[#0c0c0d]/10">
                  Shift Completed
                </span>
              )}
              {punchMsg && (
                <span className="text-xs text-indigo-600 font-semibold animate-pulse">
                  {punchMsg}
                </span>
              )}
            </div>
          )}

          {/* Notification Bell Dropdown */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => setShowNotifMenu(!showNotifMenu)}
              title="Notifications"
              className="relative p-2 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-xl transition"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-white" />
              )}
            </button>

            {/* Notification Flyout Drawer */}
            {showNotifMenu && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="p-3.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Notifications
                    </span>
                    {unreadCount > 0 && (
                      <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                        {unreadCount} new
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      className="inline-flex items-center space-x-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800"
                    >
                      <CheckCheck className="w-3 h-3" />
                      <span>Mark all read</span>
                    </button>
                  )}
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                  {notifications.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-400">
                      No notifications at this time.
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => handleNotificationClick(n)}
                        className={`p-3.5 flex items-start space-x-3 hover:bg-slate-50 transition cursor-pointer ${
                          n.is_read === 0 ? 'bg-indigo-50/30' : ''
                        }`}
                      >
                        <div className="p-2 rounded-lg bg-white border border-slate-200 shrink-0 shadow-2xs">
                          {getNotifIcon(n.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-900 truncate">
                              {n.title}
                            </span>
                            <span className="text-[10px] text-slate-400 whitespace-nowrap ml-2">
                              {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 mt-0.5 line-clamp-2 leading-relaxed">
                            {n.message}
                          </p>
                        </div>
                        {n.is_read === 0 && (
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 shrink-0 mt-2" />
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Profile Popover Dropdown */}
          <div className="relative pl-2 border-l border-slate-200" ref={userMenuRef}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center space-x-2.5 p-1.5 rounded-xl hover:bg-slate-100 transition"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-slate-800 to-indigo-900 border border-slate-300 flex items-center justify-center text-white text-xs font-bold shadow-2xs">
                {user?.first_name ? user.first_name[0] : (user?.email[0] || 'U').toUpperCase()}
              </div>

              <div className="text-left hidden md:block">
                <div className="text-xs font-bold text-slate-900 leading-tight">
                  {user?.first_name ? `${user.first_name} ${user.last_name}` : user?.email}
                </div>
                <div className="text-[10px] font-semibold text-slate-400 capitalize">
                  {user?.role.toLowerCase().replace('_', ' ')}
                </div>
              </div>

              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {/* Profile Dropdown Menu */}
            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="p-3.5 bg-slate-50 border-b border-slate-100">
                  <div className="text-xs font-bold text-slate-900 truncate">
                    {user?.email}
                  </div>
                  <div className="mt-1">
                    <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border ${getRoleBadgeColor(user?.role || '')}`}>
                      {user?.role.replace('_', ' ')}
                    </span>
                  </div>
                </div>

                <div className="p-1.5 space-y-0.5 text-xs text-slate-700">
                  {user?.employeeId && (
                    <button
                      onClick={openProfileModal}
                      className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg hover:bg-indigo-50 hover:text-indigo-600 transition text-left"
                    >
                      <PhoneCall className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600" />
                      <span className="font-medium">My Contact Details</span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      setPasswordMsg(null);
                      setShowPasswordModal(true);
                    }}
                    className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg hover:bg-indigo-50 hover:text-indigo-600 transition text-left"
                  >
                    <KeyRound className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600" />
                    <span className="font-medium">Change Password</span>
                  </button>

                  <div className="pt-1 border-t border-slate-100 mt-1">
                    <button
                      onClick={logout}
                      className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg text-rose-600 hover:bg-rose-50 transition text-left"
                    >
                      <LogOut className="w-3.5 h-3.5 text-rose-500" />
                      <span className="font-semibold">Sign Out</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Change Password Modal */}
      <Modal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        title="Change Security Credentials"
        maxWidth="md"
      >
        <form onSubmit={handleChangePassword} className="space-y-4 text-left">
          {passwordMsg && (
            <div className={`p-3 text-xs rounded-md ${passwordMsg.error ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
              {passwordMsg.text}
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Current Password</label>
            <input
              type="password"
              required
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">New Password (Min 8 chars, letters & numbers)</label>
            <input
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Confirm New Password</label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>
          <div className="flex justify-end space-x-3 pt-3">
            <button
              type="button"
              onClick={() => setShowPasswordModal(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmittingPassword}
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition disabled:opacity-50"
            >
              {isSubmittingPassword ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </form>
      </Modal>

      {/* My Contact Info Modal */}
      <Modal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        title="My Contact & Emergency Information"
        maxWidth="md"
      >
        <form onSubmit={handleUpdateProfile} className="space-y-4 text-left">
          {profileMsg && (
            <div className={`p-3 text-xs rounded-md ${profileMsg.error ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
              {profileMsg.text}
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Mobile Phone Number</label>
            <input
              type="text"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+94 77 123 4567"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Emergency Contact Person</label>
            <input
              type="text"
              required
              value={emergencyName}
              onChange={(e) => setEmergencyName(e.target.value)}
              placeholder="e.g. Spouse / Parent / Sibling"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Emergency Contact Phone</label>
            <input
              type="text"
              required
              value={emergencyPhone}
              onChange={(e) => setEmergencyPhone(e.target.value)}
              placeholder="+94 71 987 6543"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>
          <div className="flex justify-end space-x-3 pt-3">
            <button
              type="button"
              onClick={() => setShowProfileModal(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmittingProfile}
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition disabled:opacity-50"
            >
              {isSubmittingProfile ? 'Saving...' : 'Save Contact Details'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
};
