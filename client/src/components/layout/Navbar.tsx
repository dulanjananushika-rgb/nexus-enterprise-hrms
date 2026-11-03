import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../api/client';
import { Attendance } from '../../types';
import { LogOut, Clock, User as UserIcon, CheckCircle, KeyRound, PhoneCall } from 'lucide-react';
import { Modal } from '../common/Modal';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const [time, setTime] = useState<string>('');
  const [todayAttendance, setTodayAttendance] = useState<Attendance | null>(null);
  const [loadingPunch, setLoadingPunch] = useState<boolean>(false);
  const [punchMsg, setPunchMsg] = useState<string | null>(null);

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

  useEffect(() => {
    const update = () => setTime(new Date().toLocaleTimeString());
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchAttendance = async () => {
    try {
      const data = await api.getTodayAttendance();
      setTodayAttendance(data);
    } catch (err) {
      console.error('Failed to get attendance status', err);
    }
  };

  useEffect(() => {
    if (user?.employeeId) {
      fetchAttendance();
    }
  }, [user]);

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

  const openProfileModal = async () => {
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
      case 'SUPER_ADMIN': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'HR_MANAGER': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'LINE_MANAGER': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  return (
    <>
      <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-30 shadow-sm">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
              N
            </div>
            <span className="font-bold text-xl tracking-tight text-slate-900">
              NEXUS <span className="text-indigo-600 font-extrabold">HRMS</span>
            </span>
          </div>
          <div className="hidden md:flex items-center space-x-2 text-xs text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200">
            <Clock className="w-3.5 h-3.5 text-indigo-500" />
            <span className="font-mono font-medium">{time}</span>
            <span className="text-slate-300">|</span>
            <span>Colombo (GMT+5:30)</span>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          {/* Quick Punch Control */}
          {user?.employeeId && (
            <div className="hidden sm:flex items-center space-x-2">
              {!todayAttendance ? (
                <button
                  onClick={handleQuickClockIn}
                  disabled={loadingPunch}
                  className="inline-flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-1.5 rounded-md shadow-sm transition disabled:opacity-50"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>Clock In</span>
                </button>
              ) : !todayAttendance.clock_out_time ? (
                <button
                  onClick={handleQuickClockOut}
                  disabled={loadingPunch}
                  className="inline-flex items-center space-x-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold px-3 py-1.5 rounded-md shadow-sm transition disabled:opacity-50"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Clock Out</span>
                </button>
              ) : (
                <span className="text-xs text-slate-500 bg-slate-100 px-2.5 py-1 rounded border border-slate-200">
                  Shift Completed
                </span>
              )}
              {punchMsg && (
                <span className="text-xs text-indigo-600 font-medium animate-pulse">
                  {punchMsg}
                </span>
              )}
            </div>
          )}

          {/* User Role & Quick Actions */}
          <div className="flex items-center space-x-3 pl-3 border-l border-slate-200">
            <div className="text-right hidden sm:block">
              <div className="text-sm font-semibold text-slate-900 leading-none">
                {user?.first_name ? `${user.first_name} ${user.last_name}` : user?.email}
              </div>
              <div className="mt-1 flex items-center justify-end space-x-1">
                <span className={`text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded border ${getRoleBadgeColor(user?.role || '')}`}>
                  {user?.role.replace('_', ' ')}
                </span>
              </div>
            </div>

            {/* Quick Profile / Security Modal Actions */}
            <div className="flex items-center space-x-1">
              {user?.employeeId && (
                <button
                  onClick={openProfileModal}
                  title="My Contact Details"
                  className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                >
                  <PhoneCall className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => {
                  setPasswordMsg(null);
                  setShowPasswordModal(true);
                }}
                title="Change Password"
                className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
              >
                <KeyRound className="w-4 h-4" />
              </button>
            </div>

            <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-300 flex items-center justify-center text-slate-600 font-medium">
              <UserIcon className="w-4 h-4" />
            </div>

            <button
              onClick={logout}
              title="Logout"
              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
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
